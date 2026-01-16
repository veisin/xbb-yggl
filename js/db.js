// js/db.js
const DB_NAME = 'LocalDataTableSystem';
const DB_VERSION = 1;
// js/db.js

let cachedDB = null; // 全局缓存数据库实例

function initDB() {
    return new Promise((resolve, reject) => {
        // 【关键改动】如果已经连接过，直接返回缓存，不重复 open
        if (cachedDB) {
            return resolve(cachedDB);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('schemas')) {
                db.createObjectStore('schemas', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('tableData')) {
                db.createObjectStore('tableData', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('backups')) {
                db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (e) => {
            cachedDB = e.target.result; // 【关键改动】存入缓存
            window.db = cachedDB;      // 同时挂载到全局方便调试
            resolve(cachedDB);
        };

        request.onerror = (e) => {
            console.error("数据库打开失败:", e.target.error);
            reject("DB Error: " + e.target.errorCode);
        };
    });
}

//创建表
window.createTable = async function(id, title, columns) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        // 同时开启两个桶的读写事务
        const transaction = db.transaction(["schemas", "tableData"], "readwrite");
        const schemaStore = transaction.objectStore("schemas");
        const dataStore = transaction.objectStore("tableData");
        
        // 存储结构
        schemaStore.add({
            id: id, title: title, columns: columns,
            createdAt: new Date().getTime()
        });

        // 【关键修复】同步创建该表的数据记录，防止后续 get 不到
        dataStore.add({ id: id, data: [] });

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (e) => reject("表 ID 已存在或数据库错误: " + e.target.error);
    });
};
// 在 db.js 中的删除表
window.deleteTable = async function(tableId) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        // 开启读写事务，涉及两个存储桶
        const transaction = db.transaction(['schemas', 'tableData'], 'readwrite');
        const schemaStore = transaction.objectStore('schemas');
        const dataStore = transaction.objectStore('tableData');

        // 执行删除操作
        schemaStore.delete(tableId);
        dataStore.delete(tableId);

        transaction.oncomplete = () => {
            console.log(`表格 ${tableId} 及其数据已从 IndexedDB 彻底删除`);
            resolve(true);
        };

        transaction.onerror = (e) => {
            console.error("删除表格失败:", e.target.error);
            reject(e.target.error);
        };
    });
};

// 获取所有已创建的表列表
async function getAllSchemas() {
    const db = await initDB();
    return new Promise((resolve) => {
        const transaction = db.transaction(['schemas'], 'readonly');
        const request = transaction.objectStore('schemas').getAll();
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * 核心函数：更新表结构并同步数据
 * @param {string} tableId 表ID
 * @param {string} newTitle 新标题
 * @param {Array} newColumns 新的字段数组
 */
// 在 db.js 中
window.updateTableSchema = async function(tableId, newTitle, newColumns) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['schemas', 'tableData'], 'readwrite');
        const schemaStore = transaction.objectStore('schemas');
        const dataStore = transaction.objectStore('tableData');

        const schemaReq = schemaStore.get(tableId);
        schemaReq.onsuccess = () => {
            const oldSchema = schemaReq.result;
            if (!oldSchema) return reject("未找到该表结构");

            const oldColumns = oldSchema.columns;

            // 1. 更新 Schema
            schemaStore.put({ id: tableId, title: newTitle, columns: newColumns, updatedAt: Date.now() });

            // 2. 迁移数据
            const dataReq = dataStore.get(tableId);
            dataReq.onsuccess = () => {
                const result = dataReq.result || { id: tableId, data: [] };
                const rows = result.data || [];
                
                const updatedRows = rows.map(row => {
                    // 【关键修复】保留 row[0] 也就是 uniqueId
                    let newRow = [row[0]]; 
                    
                    newColumns.forEach((colName, index) => {
                        // 注意：oldColumns 索引从0开始，而 row 的数据从索引1开始
                        const oldIdxInCols = oldColumns.indexOf(colName);
                        newRow.push(oldIdxInCols !== -1 ? row[oldIdxInCols + 1] : "");
                    });
                    return newRow;
                });
                dataStore.put({ id: tableId, data: updatedRows });
            };
        };
        transaction.oncomplete = () => resolve();
    });
}

// 获取单张表的结构和数据
async function getTableFullData(tableId) {
    const db = await initDB();
    return new Promise((resolve) => {
        const transaction = db.transaction(['schemas', 'tableData'], 'readonly');
        const schemaReq = transaction.objectStore('schemas').get(tableId);
        const dataReq = transaction.objectStore('tableData').get(tableId);

        let result = { schema: null, data: [] };
        schemaReq.onsuccess = () => { result.schema = schemaReq.result; };
        dataReq.onsuccess = () => { result.data = dataReq.result ? dataReq.result.data : []; };

        transaction.oncomplete = () => resolve(result);
    });
}

// 向表中追加一行数据
// db.js 中的 addRowToTable
// db.js 建议修改
// db.js 修复版
window.addRowToTable = async function(tableId, rowData) {
    const db = await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['tableData'], 'readwrite');
        const store = transaction.objectStore('tableData');

        const request = store.get(tableId);
        request.onsuccess = () => {
            // 1. 获取原始结果
            let result = request.result;

            // 2. 健壮性检查：如果记录完全不存在，或者记录里缺失 data 数组
            if (!result) {
                result = { id: tableId, data: [] };
            } else if (!Array.isArray(result.data)) {
                result.data = []; // 强制修复缺失的 data 字段
            }

            // 3. 生成唯一 ID
            // const uniqueId = 'uid_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            // 修改为这个，几乎不可能重复
            const uniqueId = 'uid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            // 或者
            // const uniqueId = 'uid_' + crypto.randomUUID();
            const finalRow = [uniqueId, ...rowData]; 

            // 4. 现在 push 就绝对安全了
            result.data.push(finalRow);
            
            const updateRequest = store.put(result);
            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject("写入数据库失败");
        };
        
        transaction.onerror = (e) => reject("事务失败: " + e.target.error);
    });
};

// 全量覆盖某张表的数据
async function updateTableAllData(tableId, newDataArray) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['tableData'], 'readwrite');
        const store = transaction.objectStore('tableData');
        
        const request = store.get(tableId);
        request.onsuccess = () => {
            const record = request.result;
            record.data = newDataArray;
            store.put(record);
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject("保存失败");
    });
}

/**
 * 获取所有表格的配置信息（ID 和 标题）
 */
async function getAllTableConfigs() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['tableConfigs'], 'readonly');
        const store = transaction.objectStore('tableConfigs');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("无法获取表格列表");
    });
}

// db.js 单表导出
window.prepareExportData = async function(tableId) {
    const { schema, data } = await getTableFullData(tableId);
    if (!schema) throw new Error("找不到表结构");
    
    return {
        tableId: schema.id,
        title: schema.title,
        columns: schema.columns,
        data: data || [],
        exportTime: new Date().toLocaleString(),
        version: "1.0"
    };
};

// db.js - 获取数据库中所有表的所有数据
window.prepareFullBackup = async function() {
    const db = await initDB();
    // 1. 获取所有表结构
    const allSchemas = await getAllSchemas();
    
    // 2. 并行获取所有表的数据
    const backupData = await Promise.all(allSchemas.map(async (schema) => {
        const tableData = await new Promise((resolve) => {
            const transaction = db.transaction(['tableData'], 'readonly');
            const request = transaction.objectStore('tableData').get(schema.id);
            request.onsuccess = () => resolve(request.result ? request.result.data : []);
            request.onerror = () => resolve([]);
        });
        
        return {
            schema: schema,
            data: tableData
        };
    }));

    return {
        system: "YuangongManagementSystem",
        version: "2.0",
        exportTime: new Date().toLocaleString(),
        timestamp: new Date().getTime(),
        tables: backupData // 数组，每个元素包含 schema 和 data
    };
};

// db.js 数据库导入，全库还原
window.restoreFullDatabase = async function(tablesArray) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        // 开启读写事务，涉及两个存储桶
        const transaction = db.transaction(['schemas', 'tableData'], 'readwrite');
        const schemaStore = transaction.objectStore('schemas');
        const dataStore = transaction.objectStore('tableData');

        // 1. 清空当前所有数据
        schemaStore.clear();
        dataStore.clear();

        // 2. 循环写入备份中的数据
        tablesArray.forEach(item => {
            // item 包含 { schema: {...}, data: [...] }
            schemaStore.add(item.schema);
            dataStore.add({
                id: item.schema.id,
                data: item.data
            });
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(e.target.error);
    });
};


// js/db.js 追加此函数
window.deleteRowByUid = async function(tableId, uniqueId) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['tableData'], 'readwrite');
        const store = transaction.objectStore('tableData');

        const request = store.get(tableId);
        request.onsuccess = () => {
            let record = request.result;
            if (!record || !record.data) return reject("未找到表数据");

            // 核心逻辑：根据 row[0] (即 UID) 进行过滤
            const initialLength = record.data.length;
            record.data = record.data.filter(row => row[0] !== uniqueId); 

            if (record.data.length === initialLength) {
                return reject("未找到匹配的唯一ID，删除中止");
            }

            const updateRequest = store.put(record);
            updateRequest.onsuccess = () => resolve(true);
        };
        transaction.onerror = (e) => reject("事务失败: " + e.target.error);
    });
};