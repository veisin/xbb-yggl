// data_processor.js

// js/data_processor.js

/**
 * 入口函数：由 yuangong.js 点击导航时触发
 */
window.renderProcessingModule = async function(containerId) {
    const allTables = await getAllTableConfigs();
    const tableOptions = allTables.map(t => `<option value="${t.id}">${t.title || t.id}</option>`).join('');

    const html = `
    <div class="processor-outer-wrapper" style="width: 100%; grid-column: 1 / -1; padding: 20px; box-sizing: border-box; background: #f0f2f5;">
        <style>
            .top-row-container { display: flex; gap: 20px; margin-bottom: 20px; align-items: stretch; }
            .tool-card { background: #fff; border-radius: 8px; padding: 15px; border: 1px solid #e0e6ed; box-shadow: 0 2px 8px rgba(0,0,0,0.06); flex: 1; display: flex; flex-direction: column; }
            .side-box { background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #edf2f7; margin-bottom: 5px; }
            .tool-select { width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; margin: 4px 0 8px 0; font-size: 12px; }
            .btn-run { width: 100%; padding: 10px; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold; margin-top: auto; }
            label { font-size: 11px; color: #4a5568; font-weight: 600; display: block; }
            h4 { margin: 0 0 10px 0; font-size: 15px; display: flex; align-items: center; gap: 5px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
        </style>

        <div class="top-row-container">
            <div class="tool-card">
                <h4><span>🔗</span> 员工编号补全 (双字段)</h4>
                <div class="side-box">
                    <label>数据来源表 (有编号的表)</label>
                    <select id="sourceTable" class="tool-select" onchange="loadTableColumns('source')">
                        <option value="">-- 选择表 --</option>${tableOptions}
                    </select>
                    <div style="display:flex; gap:5px;">
                        <div style="flex:1"><label>姓 (Surname)</label><select id="sourceLastName" class="tool-select"></select></div>
                        <div style="flex:1"><label>名 (First Name)</label><select id="sourceFirstName" class="tool-select"></select></div>
                    </div>
                    <label>要提取的【员工编号】列</label>
                    <select id="sourceValueKey" class="tool-select"></select>
                </div>
                <div style="text-align:center; padding:5px; color:#cbd5e0;">⬇ 对比填充至 ⬇</div>
                <div class="side-box">
                    <label>目标接收表 (待补全的表)</label>
                    <select id="targetTable" class="tool-select" onchange="loadTableColumns('target')">
                        <option value="">-- 选择表 --</option>${tableOptions}
                    </select>
                    <div style="display:flex; gap:5px;">
                        <div style="flex:1"><label>姓 (Surname)</label><select id="targetLastName" class="tool-select"></select></div>
                        <div style="flex:1"><label>名 (First Name)</label><select id="targetFirstName" class="tool-select"></select></div>
                    </div>
                    <label>要填充到的【编号】列</label>
                    <select id="targetValueKey" class="tool-select"></select>
                </div>
                <button class="btn-run" style="background:#27ae60" onclick="executeAdvancedDataFill()">执行姓名匹配补全</button>
            </div>

            <div class="tool-card">
                <h4 style="border-bottom-color: #f39c12;"><span>🔎</span> 智能匹配 (姓名连写)</h4>
                <div class="side-box">
                    <label>来源：员工编号表 (分开)</label>
                    <select id="fzSourceTable" class="tool-select" onchange="loadFzColumns('source')">
                        <option value="">-- 选择来源表 --</option>${tableOptions}
                    </select>
                    <label>匹配字段 (姓 + 名)</label>
                    <div style="display:flex; gap:5px;">
                        <select id="fzSourceL" class="tool-select"></select>
                        <select id="fzSourceF" class="tool-select"></select>
                    </div>
                    <label>提取编号列</label>
                    <select id="fzSourceVal" class="tool-select"></select>
                </div>
                <div style="text-align:center; padding:5px; color:#cbd5e0;">⬇ 模糊比对 ⬇</div>
                <div class="side-box">
                    <label>目标：待补全表 (连写)</label>
                    <select id="fzTargetTable" class="tool-select" onchange="loadFzColumns('target')">
                        <option value="">-- 选择目标表 --</option>${tableOptions}
                    </select>
                    <label>“姓名连写”匹配列</label>
                    <select id="fzTargetFull" class="tool-select"></select>
                    <label>填充编号到列</label>
                    <select id="fzTargetVal" class="tool-select"></select>
                </div>
                <div style="margin:10px 0; background:#fff9f0; padding:8px; border-radius:4px;">
                    <label>容错阈值: <span id="valT">0.80</span></label>
                    <input type="range" id="fzThreshold" min="0.5" max="1" step="0.05" value="0.8" style="width:100%" oninput="$('#valT').text(parseFloat(this.value).toFixed(2))">
                </div>
                <button class="btn-run" style="background:#f39c12" onclick="executeFuzzyFill()">开始模糊匹配</button>
            </div>

            <div class="tool-card">
                <h4 style="border-bottom-color: #e74c3c;"><span>⚖️</span> 数据差集核对 (EmployeeId)</h4>
                <div class="side-box" style="border-left: 3px solid #e74c3c;">
                    <label>A 表 (全量基准库)</label>
                    <select id="diffATable" class="tool-select" onchange="loadDiffColumns('A')">
                        <option value="">-- 选择表 --</option>${tableOptions}
                    </select>
                    <label>工号列 (EmployeeId)</label>
                    <select id="diffA_IdCol" class="tool-select"></select>
                    <label>姓名列 (显示用)</label>
                    <select id="diffA_NameCol" class="tool-select"></select>
                </div>
                <div class="side-box" style="border-left: 3px solid #34495e;">
                    <label>B 表 (当前核对表)</label>
                    <select id="diffBTable" class="tool-select" onchange="loadDiffColumns('B')">
                        <option value="">-- 选择表 --</option>${tableOptions}
                    </select>
                    <label>工号列 (EmployeeId)</label>
                    <select id="diffB_IdCol" class="tool-select"></select>
                    <label>姓名列 (显示用)</label>
                    <select id="diffB_NameCol" class="tool-select"></select>
                </div>
                <div style="margin-top: 5px;">
                    <label>手动忽略(XXXXX/空/关键字)</label>
                    <textarea id="diffIgnoreList" style="width:100%; height:40px; font-size:11px;" placeholder="XXXXX"></textarea>
                </div>
                <button class="btn-run" style="background:#e74c3c" onclick="checkDataDifferencesById()">开始 ID 差集比对</button>
            </div>
        </div>

        <div class="tool-card" style="flex: none;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <label style="font-size:13px;">🖥 执行终端 & 差集详细报告</label>
                <button onclick="$('#processLog').empty()" style="padding:2px 10px; cursor:pointer;">清空终端</button>
            </div>
            <div id="processLog" style="height:350px; background:#1a252f; color:#2ecc71; padding:15px; font-family: 'Consolas', monospace; font-size:12px; overflow-y:auto; border-radius:5px; border: 1px solid #34495e;">
                > 终端准备就绪...
            </div>
        </div>
    </div>
    `;

    $(`#${containerId}`).empty().html(html).show();
};

/**
 * 动态加载列名逻辑
 */
window.loadTableColumns = async function(type) {
    const tableId = $(`#${type}Table`).val();
    if (!tableId) return;

    const fullData = await getTableFullData(tableId);
    const columns = fullData.schema.columns;
    const options = columns.map((col, index) => `<option value="${index}">${col}</option>`).join('');
    
    // 同时填充姓、名和目标列
    $(`#${type}LastName`).html(options);
    $(`#${type}FirstName`).html(options);
    $(`#${type}ValueKey`).html(options);
};

/**
 * 初始化下拉框：从 IndexedDB 获取所有表名
 */

async function initTableSelects() {
    try {
        const allTables = await getAllTableConfigs(); 
        
        // 这里的 tb.id 和 tb.title 是根据你 schemas 存储的结构来的
        const options = allTables.map(tb => {
            // 如果你存储的是标题叫 title，这里就用 title，如果是其他名字请对应修改
            const title = tb.title || tb.id; 
            return `<option value="${tb.id}">${title}</option>`;
        }).join('');
        
        $('#sourceTable').html('<option value="">-- 请选择来源表 --</option>' + options);
        $('#targetTable').html('<option value="">-- 请选择目标表 --</option>' + options);

        console.log("下拉列表初始化成功");
    } catch (err) {
        console.error("初始化下拉框失败:", err);
    }
}
//核心补全逻辑：executeAdvancedDataFill
//这是处理“姓 + 名”逻辑的核心函数。
// async function executeAdvancedDataFill() {
//     const config = {
//         sTable: $('#sourceTable').val(),
//         sLNameIdx: parseInt($('#sourceLastName').val()) + 1, // +1 是因为跳过第一列内部UID
//         sFNameIdx: parseInt($('#sourceFirstName').val()) + 1,
//         sValIdx: parseInt($('#sourceValueKey').val()) + 1,
        
//         tTable: $('#targetTable').val(),
//         tLNameIdx: parseInt($('#targetLastName').val()) + 1,
//         tFNameIdx: parseInt($('#targetFirstName').val()) + 1,
//         tValIdx: parseInt($('#targetValueKey').val()) + 1
//     };

//     if (!config.sTable || !config.tTable) return alert("请完整选择来源和目标表");

//     // 1. 获取数据
//     const sourceData = (await getTableFullData(config.sTable)).data;
//     const targetFull = await getTableFullData(config.tTable);
//     let targetData = JSON.parse(JSON.stringify(targetFull.data));

//     // 2. 建立【姓+名】映射 Map
//     const nameToIdMap = new Map();
//     sourceData.forEach(row => {
//         // 将 姓 和 名 拼接，并去除空格和转小写，增加匹配成功率
//         const fullNameKey = (String(row[config.sLNameIdx]) + String(row[config.sFNameIdx])).trim().toLowerCase();
//         const empId = String(row[config.sValIdx]).trim();
        
//         if (fullNameKey && empId && empId !== "undefined") {
//             nameToIdMap.set(fullNameKey, empId);
//         }
//     });

//     // 3. 执行匹配补全
//     let count = 0;
//     targetData = targetData.map(row => {
//         const targetNameKey = (String(row[config.tLNameIdx]) + String(row[config.tFNameIdx])).trim().toLowerCase();
        
//         if (nameToIdMap.has(targetNameKey)) {
//             row[config.tValIdx] = nameToIdMap.get(targetNameKey);
//             count++;
//         }
//         return row;
//     });

//     // 4. 保存结果
//     await updateTableAllData(config.tTable, targetData);

//     // 同步内存缓存
//     if (window.tableEditRegistry[config.tTable]) {
//         window.tableEditRegistry[config.tTable] = JSON.parse(JSON.stringify(targetData));
//     }

//     alert(`匹配完成！\n根据姓名组合成功补全了 ${count} 条员工编号。`);
    
//     // 如果当前正开着这个表，刷新显示
//     if (window.currentActiveTableId === config.tTable) {
//         renderTableView(config.tTable);
//     }
// }
async function executeAdvancedDataFill() {
    addLog("开始执行补全任务...", "info");
    
    const config = {
        sTable: $('#sourceTable').val(),
        sLNameIdx: parseInt($('#sourceLastName').val()) + 1,
        sFNameIdx: parseInt($('#sourceFirstName').val()) + 1,
        sValIdx: parseInt($('#sourceValueKey').val()) + 1,
        
        tTable: $('#targetTable').val(),
        tLNameIdx: parseInt($('#targetLastName').val()) + 1,
        tFNameIdx: parseInt($('#targetFirstName').val()) + 1,
        tValIdx: parseInt($('#targetValueKey').val()) + 1
    };

    try {
        const sourceData = (await getTableFullData(config.sTable)).data;
        const targetFull = await getTableFullData(config.tTable);
        let targetData = JSON.parse(JSON.stringify(targetFull.data));

        addLog(`读取成功: 来源表 ${sourceData.length} 条，目标表 ${targetData.length} 条`);


        // 1. 构建 Map 并增加深度调试日志
        const nameToIdMap = new Map();
        sourceData.forEach((row, i) => {
            // 打印前几行的原始数据，看看 row 到底长什么样
            if (i < 3) {
                addLog(`来源行[${i}]原始数据: ${JSON.stringify(row)}`);
            }

            const lName = String(row[config.sLNameIdx] || '').trim();
            const fName = String(row[config.sFNameIdx] || '').trim();
            const fullNameKey = (lName + fName).toLowerCase();
            const empId = String(row[config.sValIdx] || '').trim();
            
            if (fullNameKey && fullNameKey !== "undefinedundefined") {
                nameToIdMap.set(fullNameKey, empId);
            }
            
            if (i < 2) {
                addLog(`解析结果${i+1}: Key=[${fullNameKey}], 编号=[${empId}] (来自索引 ${config.sLNameIdx}, ${config.sFNameIdx})`);
            }
        });

        // 2. 执行匹配
        let count = 0;
        let failSample = "";

        targetData = targetData.map((row, i) => {
            const tlName = String(row[config.tLNameIdx] || '').trim();
            const tfName = String(row[config.tFNameIdx] || '').trim();
            const targetNameKey = (tlName + tfName).toLowerCase();
            
            if (nameToIdMap.has(targetNameKey)) {
                row[config.tValIdx] = nameToIdMap.get(targetNameKey);
                count++;
            } else if (failSample === "" && targetNameKey !== "") {
                failSample = targetNameKey; // 记录第一个没匹配上的名字
            }
            return row;
        });

        // 3. 保存并反馈
        if (count > 0) {
            await updateTableAllData(config.tTable, targetData);
            if (window.tableEditRegistry[config.tTable]) {
                window.tableEditRegistry[config.tTable] = JSON.parse(JSON.stringify(targetData));
            }
            addLog(`补全成功！成功更新了 ${count} 条数据`, "success");
            alert(`成功补全了 ${count} 条员工编号`);
        } else {
            addLog(`未发现匹配项。目标表首个尝试匹配的 Key 为: [${failSample}]`, "error");
            addLog(`请核对来源样本中的 Key 是否包含该字符。`, "error");
        }

        if (window.currentActiveTableId === config.tTable) renderTableView(config.tTable);

    } catch (err) {
        addLog("程序运行出错: " + err.message, "error");
    }
}

/**
 * 获取所有表格的配置信息
 */
async function getAllTableConfigs() {
    // 统一用你的方式：直接 await 获取实例
    // 这样不需要依赖 window.db，也不怕加载顺序问题
    const dbInstance = await initDB(); 

    return new Promise((resolve, reject) => {
        try {
            // 使用你 initDB 里定义的 'schemas' 存储空间
            const transaction = dbInstance.transaction(['schemas'], 'readonly');
            const store = transaction.objectStore('schemas');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("无法获取 schemas 列表");
        } catch (e) {
            reject("获取表格配置失败: " + e.message);
        }
    });
}

/**
 * 跨表数据补全核心逻辑
 */
async function executeDataFill() {
    const config = {
        sTableId: $('#sourceTable').val(),
        sMatchIdx: parseInt($('#sourceMatchKey').val()), // 索引
        sValueIdx: parseInt($('#sourceValueKey').val()),
        tTableId: $('#targetTable').val(),
        tMatchIdx: parseInt($('#targetMatchKey').val()),
        tValueIdx: parseInt($('#targetValueKey').val())
    };

    if (!config.sTableId || !config.tTableId) return alert("请选择来源表和目标表");

    // 1. 获取两表全量数据
    const sourceData = (await getTableFullData(config.sTableId)).data;
    const targetFull = await getTableFullData(config.tTableId);
    let targetData = JSON.parse(JSON.stringify(targetFull.data)); // 深拷贝防止直接污染

    // 2. 将来源表转为 Map 提高查询速度 (VLOOKUP 思想)
    // Map 结构: { "张三": "SN001", "李四": "SN002" }
    const sourceMap = new Map();
    sourceData.forEach(row => {
        const key = String(row[config.sMatchIdx + 1]).trim(); // +1 是因为跳过 UID 列
        const value = String(row[config.sValueIdx + 1]).trim();
        if (key) sourceMap.set(key, value);
    });

    // 3. 遍历目标表进行填充
    let fillCount = 0;
    targetData = targetData.map(row => {
        const matchValue = String(row[config.tMatchIdx + 1]).trim();
        if (sourceMap.has(matchValue)) {
            row[config.tValueIdx + 1] = sourceMap.get(matchValue);
            fillCount++;
        }
        return row;
    });

    // 4. 写回数据库并更新内存
    await updateTableAllData(config.tTableId, targetData);
    
    // 关键：如果目标表当前正打开着，需要同步它的内存注册表
    if (window.tableEditRegistry[config.tTableId]) {
        window.tableEditRegistry[config.tTableId] = JSON.parse(JSON.stringify(targetData));
        window.tableOriginalRegistry[config.tTableId] = JSON.parse(JSON.stringify(targetData));
    }

    alert(`补全完成！共成功匹配并填充了 ${fillCount} 条数据。`);
    
    // 如果当前正处于该表的 Tab，刷新视图
    if (window.currentActiveTableId === config.tTableId) {
        renderTableView(config.tTableId);
    }
}

//通用的打印函数
function addLog(msg, type = 'info') {
    const $log = $('#processLog');
    const color = type === 'error' ? '#f44336' : (type === 'success' ? '#4caf50' : '#d4d4d4');
    const time = new Date().toLocaleTimeString();
    $log.append(`<div style="color:${color}">[${time}] ${msg}</div>`);
    $log.scrollTop($log[0].scrollHeight); // 自动滚动到底部
}

/**
 * 计算两个字符串的相似度 (0-1)
 */
function getSimilarity(s1, s2) {
    let len1 = s1.length;
    let len2 = s2.length;
    let matrix = [];

    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            let cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // 插入
                matrix[i][j - 1] + 1,      // 删除
                matrix[i - 1][j - 1] + cost // 替换
            );
        }
    }
    let distance = matrix[len1][len2];
    // 返回相似度百分比，1.0 是完全匹配
    return 1 - distance / Math.max(len1, len2);
}

async function executeFuzzyFill() {
    addLog("--- 开始多策略智能匹配任务 ---", "info");
    const threshold = parseFloat($('#fzThreshold').val());
    
    const config = {
        sId: $('#fzSourceTable').val(), 
        sL: parseInt($('#fzSourceL').val())+1, 
        sF: parseInt($('#fzSourceF').val())+1, 
        sV: parseInt($('#fzSourceVal').val())+1,
        tId: $('#fzTargetTable').val(), 
        tFull: parseInt($('#fzTargetFull').val())+1, 
        tV: parseInt($('#fzTargetVal').val())+1
    };

    try {
        const sourceData = (await getTableFullData(config.sId)).data;
        const targetFull = await getTableFullData(config.tId);
        let targetData = JSON.parse(JSON.stringify(targetFull.data));

        // 1. 准备来源库 (预处理，提高效率)
        const sourceList = sourceData.map(row => {
            const ln = String(row[config.sL] || '').trim().toLowerCase();
            const fn = String(row[config.sF] || '').trim().toLowerCase();
            return {
                lastName: ln,
                firstName: fn,
                combined: (ln + fn).replace(/\s+/g, ""), // 连写
                id: String(row[config.sV] || '').trim()
            };
        }).filter(item => item.id && (item.lastName || item.firstName));

        let countExact = 0;   // 精准匹配数
        let countFuzzy = 0;   // 模糊匹配数
        let failList = [];

        // 2. 遍历目标表执行“三级跳”
        for (let i = 0; i < targetData.length; i++) {
            const row = targetData[i];
            const targetRaw = String(row[config.tFull] || '').trim().toLowerCase();
            const targetClean = targetRaw.replace(/\s+/g, ""); // 去空格连写
            
            if (!targetClean || targetClean === "undefined") continue;

            let foundId = null;
            let matchType = "";
            let bestScore = 0;
            let bestMatchItem = null;

            // --- 第一级 & 第二级：尝试精准/包含匹配 ---
            for (const s of sourceList) {
                // 场景A: 目标完全等于连写、或者等于姓、或者等于名
                if (targetClean === s.combined || targetClean === s.lastName || targetClean === s.firstName) {
                    foundId = s.id;
                    matchType = "精准匹配";
                    break;
                }
                // 场景B: 目标包含完整的连写姓名 (例如 "Manager AliTekel" 包含 "alitekel")
                if (targetClean.includes(s.combined) && s.combined.length > 2) {
                    foundId = s.id;
                    matchType = "包含匹配";
                    break;
                }
            }

            // --- 第三级：如果还没找到，开启模糊海选 ---
            if (!foundId) {
                sourceList.forEach(s => {
                    let score = getSimilarity(targetClean, s.combined);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatchItem = s;
                    }
                });

                if (bestScore >= threshold) {
                    foundId = bestMatchItem.id;
                    matchType = `模糊匹配(${(bestScore * 100).toFixed(0)}%)`;
                }
            }

            // 执行填充
            if (foundId) {
                targetData[i][config.tV] = foundId;
                if (matchType.includes("模糊")) {
                    countFuzzy++;
                    addLog(`[${matchType}] 目标:${targetRaw} -> 匹配:${bestMatchItem.combined}`, "success");
                } else {
                    countExact++;
                }
            } else {
                failList.push(targetRaw);
            }
        }

        // 3. 结果写回与反馈
        if (countExact + countFuzzy > 0) {
            await updateTableAllData(config.tId, targetData);
            if (window.tableEditRegistry[config.tId]) window.tableEditRegistry[config.tId] = targetData;
            
            addLog(`任务完成！精准:${countExact}条，模糊:${countFuzzy}条`, "success");
            if (failList.length > 0) {
                addLog(`未匹配样本: ${failList.slice(0, 3).join(', ')}...`, "error");
            }
            alert(`匹配成功！\n精准匹配: ${countExact}\n模糊匹配: ${countFuzzy}`);
        } else {
            addLog("未发现任何匹配项，请尝试调低容错阈值。", "error");
        }

        if (window.currentActiveTableId === config.tId) renderTableView(config.tId);

    } catch (e) {
        addLog("执行失败: " + e.message, "error");
        console.error(e);
    }
}

/**
 * 专门为模糊匹配卡片加载列名
 */
window.loadFzColumns = async function(type) {
    const tableId = $(`#fz${type === 'source' ? 'Source' : 'Target'}Table`).val();
    if (!tableId) return;

    try {
        const fullData = await getTableFullData(tableId);
        const columns = fullData.schema.columns;
        const options = columns.map((col, index) => `<option value="${index}">${col}</option>`).join('');
        
        if (type === 'source') {
            $('#fzSourceL').html(options);
            $('#fzSourceF').html(options);
            $('#fzSourceVal').html(options);
        } else {
            $('#fzTargetFull').html(options);
            $('#fzTargetVal').html(options);
        }
        addLog(`已加载 ${type === 'source' ? '来源' : '目标'} 表的列字段`);
    } catch (err) {
        addLog("加载列失败: " + err.message, "error");
    }
};
//这个函数会找出两表之间互相缺失的名字，并应用你在文本框里输入的过滤名单。
async function checkDataDifferences() {
    addLog("--- 开始执行 ID 维度差集核对 ---", "info");
    
    const config = {
        aId: $('#diffATable').val(),
        aIdCol: parseInt($('#sourceValueKey').val()) + 1, // A表工号列
        aNameCol: parseInt($('#sourceLastName').val()) + 1, // A表姓名列(用于输出展示)
        
        bId: $('#diffBTable').val(),
        bIdCol: parseInt($('#fzTargetVal').val()) + 1,    // B表工号列
        bNameCol: parseInt($('#fzTargetFull').val()) + 1, // B表姓名列(用于输出展示)
    };

    if (!config.aId || !config.bId) return alert("请确保已选择 A、B 两张表及其对应的工号列");

    try {
        const dataA = (await getTableFullData(config.aId)).data;
        const dataB = (await getTableFullData(config.bId)).data;

        // 1. 整理 A 表数据：Map<Id, Name>
        const mapA = new Map();
        dataA.forEach(row => {
            const id = String(row[config.aIdCol] || '').trim();
            const name = String(row[config.aNameCol] || '').trim();
            if (id && id !== "undefined") {
                mapA.set(id, name);
            }
        });

        // 2. 整理 B 表数据：Map<Id, Name> 和 记录异常行
        const mapB = new Map();
        const bSpecialCases = []; // 存放 ID 为空或 XXXXX 的行

        dataB.forEach((row, i) => {
            const id = String(row[config.bIdCol] || '').trim();
            const name = String(row[config.bNameCol] || '').trim();
            
            // 排除表头或全空行
            if (!id && !name) return;

            // 处理特殊情况：为空 或 为 XXXXX
            if (!id || id.toUpperCase() === "XXXXX" || id === "undefined") {
                bSpecialCases.push({ index: i + 1, name: name, id: id || "空" });
            } else {
                mapB.set(id, name);
            }
        });

        addLog(`读取完毕: A表有效ID ${mapA.size} 个, B表有效ID ${mapB.size} 个`, "info");

        // 3. 执行比对逻辑
        
        // A有 B没有：B表漏掉了哪些工号
        const missingInB = [];
        mapA.forEach((name, id) => {
            if (!mapB.has(id)) {
                missingInB.push({ id, name });
            }
        });

        // B有 A没有：B表出现了哪些 A库里不存在的工号
        const missingInA = [];
        mapB.forEach((name, id) => {
            if (!mapA.has(id)) {
                missingInA.push({ id, name });
            }
        });

        // 4. 渲染详细报告
        $('#processLog').empty();
        addLog(`📊 ID 比对报告 (${new Date().toLocaleTimeString()})`, "success");

        addLog(`\n[ 1. A表有，但B表缺失的 ID ] (${missingInB.length}条)`, "error");
        if (missingInB.length > 0) {
            missingInB.forEach(item => addLog(`   • ID: ${item.id} (${item.name})`));
        } else {
            addLog("   (无缺失)");
        }

        addLog(`\n[ 2. B表有，但A表库不存在的 ID ] (${missingInA.length}条)`, "warn");
        if (missingInA.length > 0) {
            missingInA.forEach(item => addLog(`   • ID: ${item.id} (${item.name})`));
        } else {
            addLog("   (无多余)");
        }

        addLog(`\n[ 3. B表中 ID 异常(为空或XXXXX) ] (${bSpecialCases.length}条)`, "info");
        if (bSpecialCases.length > 0) {
            bSpecialCases.forEach(item => addLog(`   • 行 ${item.index}: ${item.name} (当前ID: ${item.id})`));
        } else {
            addLog("   (无异常)");
        }

    } catch (e) {
        addLog("比对程序故障: " + e.message, "error");
    }
}

// 辅助函数：加载核对列
window.loadDiffColumns = async function(type) {
    const tableId = $(`#diff${type}Table`).val();
    if (!tableId) return;

    try {
        const fullData = await getTableFullData(tableId);
        const columns = fullData.schema.columns;
        const options = columns.map((col, index) => `<option value="${index}">${col}</option>`).join('');
        
        if (type === 'A') {
            $('#diffA_IdCol').html(options);
            $('#diffA_NameCol').html(options);
            addLog(`已加载 A 表 [${tableId}] 的列字段`);
        } else {
            $('#diffB_IdCol').html(options);
            $('#diffB_NameCol').html(options);
            addLog(`已加载 B 表 [${tableId}] 的列字段`);
        }
    } catch (err) {
        addLog("加载列失败: " + err.message, "error");
    }
};

async function checkDataDifferencesById() {
    addLog("--- 正在执行严格过滤与差集核对 (V4.0) ---", "info");
    
    // 获取下拉框选中的索引
    const aIdSel = $('#diffA_IdCol').val();
    const aNameSel = $('#diffA_NameCol').val();
    const bIdSel = $('#diffB_IdCol').val();
    const bNameSel = $('#diffB_NameCol').val();

    if (aIdSel === null || bIdSel === null) {
        return addLog("错误：请先选择 A 表和 B 表的工号列", "error");
    }

    const config = {
        // 关键：统一使用 +1 偏移来跳过 UID 列
        aIdIdx: parseInt(aIdSel) + 1,
        aNameIdx: parseInt(aNameSel) + 1,
        bIdIdx: parseInt(bIdSel) + 1,
        bNameIdx: parseInt(bNameSel) + 1,
        manualIgnore: $('#diffIgnoreList').val().toUpperCase().split('\n').map(s => s.trim()).filter(s => s)
    };

    try {
        // 1. 获取 Filter 表数据 (严格对应你的 JSON 结构)
        let dbFilters = new Map();
        try {
            const filterRes = await getTableFullData('Filter'); // 注意 ID 大小写需对应 schema
            if (filterRes && filterRes.data) {
                filterRes.data.forEach(row => {
                    // row[1] 是 EmployeeId (EMP0020), row[2] 是 FilterTable (A)
                    const fId = String(row[1] || '').trim().toUpperCase();
                    const fAction = String(row[2] || '').trim().toUpperCase();
                    if (fId && fId !== "UNDEFINED") {
                        dbFilters.set(fId, fAction); 
                    }
                });
                addLog(`✅ 已加载过滤规则: ${dbFilters.size} 条 (包含 ${Array.from(dbFilters.keys()).slice(0,3).join(',')}...)`);
            }
        } catch (e) {
            addLog("⚠️ 未发现名为 'Filter' 的表，仅使用 XXXXX 过滤。", "warn");
        }

        const resA = await getTableFullData($('#diffATable').val());
        const resB = await getTableFullData($('#diffBTable').val());
        
        const dataA = resA.data;
        const dataB = resB.data;

        // 2. 处理 A 表 (基准库)
        const mapA = new Map();
        let aExcludeCount = 0;

        dataA.forEach((row) => {
            const idRaw = String(row[config.aIdIdx] || '').trim();
            const idUpper = idRaw.toUpperCase();
            const name = String(row[config.aNameIdx] || 'Unknown');

            // 过滤条件：ID 为空、undefined、Filter 表中标记为 A、手动忽略
            if (!idRaw || idUpper === "UNDEFINED" || idUpper === "") return;

            if (dbFilters.get(idUpper) === 'A' || config.manualIgnore.includes(idUpper)) {
                aExcludeCount++;
            } else {
                mapA.set(idUpper, { id: idRaw, name: name });
            }
        });

        // 3. 处理 B 表 (待核对表)
        const mapB = new Map();
        const bEmptyIdList = []; 
        let bExcludeCount = 0;

        dataB.forEach((row, i) => {
            const idRaw = String(row[config.bIdIdx] || '').trim();
            const idUpper = idRaw.toUpperCase();
            const name = String(row[config.bNameIdx] || '').trim();

            if (!idRaw || idUpper === "UNDEFINED" || idUpper === "") {
                // 将 ID 为空的重要人员记录下来
                bEmptyIdList.push({ line: i + 1, name: name });
            } 
            else if (idUpper === 'XXXXX' || dbFilters.get(idUpper) === 'B' || config.manualIgnore.includes(idUpper)) {
                bExcludeCount++;
            } 
            else {
                mapB.set(idUpper, { id: idRaw, name: name });
            }
        });

        // 4. 比对差集
        const aOnly = []; // A有 B无
        mapA.forEach((info, id) => {
            if (!mapB.has(id)) aOnly.push(info);
        });

        const bOnly = []; // B有 A无
        mapB.forEach((info, id) => {
            if (!mapA.has(id)) bOnly.push(info);
        });

        // 5. 最终输出
        const log = $('#processLog');
        log.empty();
        addLog(`📊 核对任务完成 [${new Date().toLocaleTimeString()}]`, "success");

        if (bEmptyIdList.length > 0) {
            addLog(`\n🚨 【严重提醒】B（公寓表） 表中 ID 为空的人员 (${bEmptyIdList.length}人):`, "warn");
            bEmptyIdList.forEach(item => addLog(`   • 第 ${item.line} 行: ${item.name}`));
        }

        addLog(`\n❌ [ A（员工表）表存在，但 B表缺失 ] (${aOnly.length}人)`, "error");
        aOnly.forEach(item => addLog(`   • ID: ${item.id} | Name: ${item.name}`));

        addLog(`\n⚠️ [ B（公寓表）表存在，但 A表库找不到 ] (${bOnly.length}人)`, "warn");
        bOnly.forEach(item => addLog(`   • ID: ${item.id} | Name: ${item.name}`));

        addLog(`\n--------------------------------------------`);
        addLog(`🔍 过滤统计 (已彻底排除，不计入上述缺失名单)：`, "info");
        addLog(`   • A（员工表）表基准库已排除: ${aExcludeCount} 人 (Filter标记A或手动忽略)`);
        addLog(`   • B（公寓表）表核对中已拦截: ${bExcludeCount} 人 (Filter标记B、XXXXX或手动忽略)`);

    } catch (e) {
        addLog("执行失败: " + e.message, "error");
    }
}