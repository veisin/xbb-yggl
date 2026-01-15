// js/yuangong.js
// 在文件顶部声明两个注册表
window.tableDataRegistry = {};     // 存放“修改中”的数据（用于显示和编辑）
window.tableOriginalRegistry = {}; // 存放“数据库”的数据（只读，用于红字对比）
// --- 全局变量 ---
window.openTabs = []; // 记录已打开的标签
let currentActiveTableId = null;
window.tableSortState = window.tableSortState || {};//排序状态存储（全局）
window.tableEditRegistry = window.tableEditRegistry || {};
window.tableViewRegistry = window.tableViewRegistry || {};
let currentExportTableId = '';// 全局暂存 导出 tableId

$(document).ready(async function () {
    // 1. 初始化数据库
    const db = await initDB();

    // 渲染左侧菜单导航栏
    refreshSidebarMenu();

    //导出excel的点击事件
    $('#btnDoExport').on('click', startExportProcess);
    $('#btnCancelExport').on('click', () => $('#exportConfigModal').hide());

    // 2. 侧边栏折叠/展开
    $('#sidebarCollapse').on('click', function () {
        $('#sidebar').toggleClass('active');
        // 折叠时，关闭所有已经打开的二级菜单
        if ($('#sidebar').hasClass('active')) {
            $('.collapse').hide();
            $('.nav-item').removeClass('open');
        }
    });

    // // 监听左侧菜单点击
    // $(document).on('click', '.nav-link[data-type="table"]', function() {
    //     const id = $(this).data('id');
    //     const title = $(this).find('.menu-text').text() || $(this).text().trim();
        
    //     console.log("Step 1: 点击了菜单 -> ID:", id, "标题:", title);
        
    //     // 1. 先处理标签逻辑
    //     openNewTab(id, title);
    // });

    // 点击右侧标签项切换
    $(document).on('click', '.tab-item', function(e) {
        if($(e.target).hasClass('close-tab')) return;
        const id = $(this).data('id');
        switchTab(id);
    });

    // 处理一级菜单的点击展开/收起
    $(document).on('click', '.dropdown-toggle', function (e) {
        e.preventDefault();
        const $parent = $(this).parent();
        
        // 切换 open 类（用于箭头旋转）
        $parent.toggleClass('open');
        
        // 展开或收起下方的 ul 列表
        $(this).next('.collapse').slideToggle(200);

        // 如果侧边栏当前是 50px 折叠状态，点击时自动展开侧边栏
        if ($('#sidebar').hasClass('active')) {
            $('#sidebar').removeClass('active');
        }
    });

    // 修改后的通用左侧菜单 导航点击 监听
    $(document).on('click', '.nav-link', function(e) {
        // 阻止某些带有 a 标签的默认跳转
        e.preventDefault(); 
        
        const $el = $(this);
        const id = $el.data('id');
        const type = $el.data('type'); // table 或 module
        const title = $el.data('title'); // 直接从 data-title 取，更准确

        if (!id) return; // 如果没有 id，说明不是叶子节点，不处理

        // 核心逻辑：一律进入 Tab 管理系统
        openNewTab(id, title, type);
    });

    // 5. 模拟加载已有的表格 (假设我们有5-7个表)
    loadTableList();

    //--------------------------------------------------
    // 弹窗 功能
    //--------------------------------------------------
    // 2. 关闭弹窗
    $(document).on('click', '.close-modal, .btn-cancel', function(e) {
        
        // 1. 找到当前点击元素向上最近的一个遮罩层容器
        const $modal = $(this).closest('.modal-overlay');
        
        // 2. 隐藏它
        $modal.fadeOut(200); 
        
        // 3. 如果里面有表单，重置数据
        const $form = $modal.find('form');
        if($form.length > 0) $form[0].reset();
    });
    // 点击弹窗背景（遮罩层）也可以关闭窗口（可选，提升体验）
    // 修改原本的 modal-overlay 点击逻辑
    $(document).on('click', '.modal-overlay', function(e) {
        if ($(e.target).hasClass('modal-overlay')) {
            const modalId = $(this).attr('id');
            
            // 如果是数据录入窗，走安全关闭逻辑
            if (modalId === 'dataEntryModal') {
                safeCloseDataModal();
            } else {
                $(this).hide();
            }
        }
    });
    // 按下键盘 Esc 键关闭当前显示的弹窗
    $(document).on('keydown', function(e) {
        if (e.keyCode === 27) { // Esc 键
            if ($('#dataEntryModal').is(':visible')) {
                safeCloseDataModal();
            } else {
                $('.modal-overlay').hide();
            }
        }
    });

    //--------------------------------------------------
    // *************************************************
    //--------------------------------------------------


    //--------------------------------------------------
    // 修改表名/字段 功能
    //--------------------------------------------------

    // --- 2. 渲染管理主页面 ---
    async function renderSchemaManager() {
        const schemas = await getAllSchemas(); // 从 db.js 获取所有表
        let html = `
            <div class="manage-container">
                <div style="margin-bottom:20px;">
                    <h2>🛠️ 表结构管理中心</h2>
                    <p>在这里你可以修改已有表格的名称、增加或删除字段。</p>
                </div>
                <div class="table-grid">
        `;

        if (schemas.length === 0) {
            html += `<p>暂无表格，请先创建表格。</p>`;
        }

        schemas.forEach(s => {
            html += `
                <div class="table-card">
                    <div class="card-info">
                        <strong>${s.title}</strong>
                        <span>ID: ${s.id} | 字段数: ${s.columns.length}</span>
                    </div>
                    <button class="btn-edit-schema" data-id="${s.id}">管理结构</button>
                </div>
            `;
        });

        html += `</div></div>`;
        $('#mainView').html(html);
    }

    // --- 3. 打开编辑弹窗并预填数据 ---
    $(document).on('click', '.btn-edit-schema', async function() {
        const id = $(this).data('id');
        const schemas = await getAllSchemas();
        const schema = schemas.find(s => s.id === id);

        if (schema) {
            $('#editTableId').val(schema.id);
            $('#editingTableNameDisplay').text(schema.title);
            $('#editTableTitle').val(schema.title);
            // 将数组转回换行符分隔的文本供编辑
            $('#editTableColumns').val(schema.columns.join('\n'));
            $('#editTableModal').css('display', 'flex');
        }
    });

    // --- 4. 保存变更 (调用 db.js 的更新逻辑) ---
    $('#updateTableBtn').on('click', async function() {
        const id = $('#editTableId').val();
        const newTitle = $('#editTableTitle').val().trim();
        const columnText = $('#editTableColumns').val();
        const newColumns = columnText.split(/[,\n]/).map(c => c.trim()).filter(c => c !== "");

        if (!newTitle || newColumns.length === 0) {
            showMsg("名称和字段不能为空", "error"); 
            return;
        }

        const confirmed = await showConfirm("确定要修改表结构吗？如果删除了字段，对应的数据也将被永久删除！", "危险操作警告");
    
        if (confirmed) {
            // 用户点了“确定”
            try {
                await updateTableStructure(id, newTitle, newColumns);
                showMsg("变更成功！", "success");
                // ... 后续逻辑 ...
                $('#editTableModal').hide();
                renderSchemaManager(); // 刷新管理页
                refreshSidebarMenu();  // 刷新左侧菜单
            } catch (err) {
                showMsg("保存失败: " + err, "error");
            }
        }
    });


    //--------------------------------------------------
    // *************************************************
    //--------------------------------------------------

    //--------------------------------------------------
    // 新增表格一条数据 功能
    //--------------------------------------------------

    // --- 1. 点击左侧菜单：添加或切换 Tab ---


    // 3. 打开新增弹窗（动态生成输入框）
    $(document).on('click', '#openAddDataBtn', async function() {
        const fullData = await getTableFullData(currentActiveTableId);
        const columns = fullData.schema.columns;

        $('#entryTableTitle').text(fullData.schema.title);
        
        // 动态生成输入框，每行显示 2 个以适应 24 列
        let formHtml = '';
        columns.forEach((col, index) => {
            formHtml += `
                <div class="form-item">
                    <label>${col}</label>
                    <input type="text" class="data-input" data-index="${index}" placeholder="请输入${col}">
                </div>
            `;
        });
        $('#dataEntryForm').html(formHtml);
        $('#dataEntryModal').css('display', 'flex');
    });

    // 4. 表格 新增数据 按钮 保存操作
    $(document).on('click', '#saveDataRowBtn', async function() {
        const tableId = $(this).data('table-id');
        
        // 1. 收集数据 (按顺序存入数组)
        let rowData = [];
        let hasValue = false;
        
        $('#dataEntryForm .data-input').each(function() {
            const val = $(this).val().trim();
            rowData.push(val);
            if (val !== "") hasValue = true; // 简单的非空校验
        });

        if (!hasValue) {
            showMsg("请至少输入一项数据", "warning");
            return;
        }

        try {
            // 2. 调用 db.js 的存入函数 (如果没有请补上)
            await addRowToTable(tableId, rowData);
            
            showMsg("数据已成功录入", "success");
            
            // 3. 关闭弹窗并清空表单
            $('#dataEntryModal').fadeOut(200);
            
            // 4. 重点：刷新当前的表格视图，让新数据立即显示
            await renderTableView(tableId);
            
        } catch (err) {
            showMsg("保存数据失败: " + err, "error");
        }
    });

    //--------------------------------------------------
    // *************************************************
    //--------------------------------------------------


    //--------------------------------------------------
    // 双击单元格 修改数据 功能
    //--------------------------------------------------
    $(document).on('dblclick', '.editable-cell', function() {
        const $td = $(this);
        if ($td.find('input').length > 0) return;

        const currentVal = $td.text();
        const $input = $(`<input type="text" class="cell-edit-input" value="${currentVal}">`);
        
        $td.html($input);
        $input.focus().select();

        $input.on('blur keydown', function(e) {
            if (e.type === 'keydown' && e.keyCode !== 13) return;

            const tableId = $td.data('table');
            const rowId = $td.data('row-id'); 
            const colIdx = $td.data('col');   
            const newVal = $input.val().trim(); // 建议加上 trim()
            const originalVal = ($td.data('original') || "").toString();

            // 1. 更新【编辑注册表】中的数据（这是真理之源）
            const targetRow = window.tableEditRegistry[tableId].find(r => r[0] === rowId);
            if (targetRow) {
                targetRow[colIdx] = newVal; 
            }

            // 2. 局部更新 DOM 状态，而不是直接调用 renderTableView
            // 这样可以避免整表重绘导致的视觉闪烁，且逻辑更连贯
            $td.text(newVal);
            
            if (newVal !== originalVal) {
                $td.addClass('is-modified');
            } else {
                $td.removeClass('is-modified');
            }

            // 3. 统一控制保存按钮的状态
            // hasChanges 是你定义的那个比较两个 Registry 的函数
            if (hasChanges(tableId)) {
                $(`#btn-save-${tableId}`).fadeIn();
            } else {
                $(`#btn-save-${tableId}`).fadeOut();
            }
        });
    });

    //--------------------------------------------------
    // *************************************************
    //--------------------------------------------------

    //--------------------------------------------------
    // 点击列名实现排序 功能
    //--------------------------------------------------

    $(document).on('click', '.sortable-th', function () {
        const colIndex = parseInt($(this).data('col'), 10); // 拿到的应该是 1, 2, 3...

        // 自动获取 tableId
        const tableId = $(this)
            .closest('.table-container')
            .attr('id')
            ?.replace('container-', '');

        if (!tableId) {
            console.warn('未找到 tableId');
            return;
        }

        // 初始化排序状态容器
        window.tableSortState = window.tableSortState || {};
        window.tableSortState[tableId] = window.tableSortState[tableId] || { colIndex: null, direction: null };

        const state = window.tableSortState[tableId];

        // 三态切换逻辑：升序 -> 降序 -> 取消排序
        if (state.colIndex !== colIndex) {
            state.colIndex = colIndex;
            state.direction = 'asc';
        } else if (state.direction === 'asc') {
            state.direction = 'desc';
        } else if (state.direction === 'desc') {
            state.colIndex = null;
            state.direction = null;
        }

        // 调用执行排序的方法
        applySortAndRender(tableId);
    });

    //--------------------------------------------------
    // *************************************************
    //--------------------------------------------------


    //--------------------------------------------------
    // 点击某行显示在右侧 详情 功能
    //--------------------------------------------------
    // 点击行显示详情
    $(document).on('click', '.main-table tbody tr', async function() {
        const $row = $(this);
        const rowId = $row.data('row-id');
        const tableId = $row.find('td.editable-cell').first().data('table');

        if (!tableId || !rowId) return;

        // 1. 切换选中样式 (CSS 控制)
        $row.addClass('is-selected').siblings().removeClass('is-selected');

        // 2. 获取数据
        let schema = window.allSchemas?.find(s => s.id === tableId);
        if (!schema) {
            const fullData = await getTableFullData(tableId);
            schema = fullData.schema;
        }
        const rowData = window.tableEditRegistry[tableId]?.find(r => r[0] == rowId);

        if (!schema || !rowData) return;

        // 3. 极简 HTML 生成 (完全依赖外部 CSS 类名)
        let detailHtml = `
            <div class="detail-container">
                <h4 class="detail-header">数据详情</h4>
                <div class="detail-list">
                    ${schema.columns.map((colName, index) => `
                        <div class="detail-item">
                            <span class="detail-label">${colName}</span>
                            <span class="detail-value">${rowData[index + 1] ?? '-'}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        $(`#detail-panel-${tableId}`).html(detailHtml);
    });
    //--------------------------------------------------
    // *************************************************
    //--------------------------------------------------


    //******
    //******
    //******
    //******
    //******





    //--------------------------------------------------
    // xxxx 功能
    //--------------------------------------------------

    //--------------------------------------------------
    // *************************************************
    //--------------------------------------------------




});
    //--------------------------------------------------
    // 创建新表格 出时候函数 功能
    //--------------------------------------------------
    // 渲染创建表格的界面 (直接在 Tab 里显示，不再用弹窗，这样体验更好)
    function renderCreateTableUI() {
        const html = `
            <div class="module-card">
                <h3>🛠️ 创建新数据表</h3>
                <p style="color: #666; font-size: 0.9em;">请定义表格的基础结构，ID 创建后通常不可更改。</p>
                <hr>
                <div class="form-group">
                    <label>表格唯一 ID (英文/数字/下划线):</label>
                    <input type="text" id="newTableId" placeholder="例如: yuangong_table" class="form-control">
                </div>
                <div class="form-group">
                    <label>表格显示名称 (中文):</label>
                    <input type="text" id="newTableName" placeholder="例如: 员工信息表" class="form-control">
                </div>
                <div class="form-group">
                    <label>定义初始列名 (用英文逗号隔开 或者 每行一个列名):</label>
                    <textarea id="newTableColumns" placeholder="姓名, 性别, 职位, 电话" class="form-control" rows="3"></textarea>
                </div>
                <div style="margin-top:20px;">
                    <button class="btn-confirm" onclick="handleCreateNewTable()">确认创建表格</button>
                </div>
            </div>
        `;
        $('#tabContent').html(html);
    }
    //列名定义 解析函数
    function parseColumns(text) {
        // 正则表达式：[,\n，] 表示匹配 英文逗号、换行符、中文逗号
        return text.split(/[,\n，]/)
                   .map(c => c.trim())          // 去掉空格
                   .filter(c => c.length > 0);  // 过滤掉空行或多余的逗号
    }

    async function handleCreateNewTable() {
        const id = $('#newTableId').val().trim();
        const title = $('#newTableName').val().trim();
        const colsRaw = $('#newTableColumns').val(); // 获取原始文本
    
        const cols = parseColumns(colsRaw); // 使用新解析逻辑
        // 基础校验
        if (!id || !/^[a-zA-Z0-9_]+$/.test(id)) {
            showMsg("ID 只能包含英文、数字和下划线！", "error");
            return;
        }
        if (!id || !title || cols.length === 0) {
            showMsg("请填写完整信息，且至少定义一个列！", "error");
            return;
        }

        // const cols = colsText.split(',').map(c => c.trim()).filter(c => c !== "");

        try {
            // 调用 db.js 中的创建函数 (请确保你的 db.js 支持传入 id 和 title)
            await createTable(id, title, cols); 
            showMsg(`表格 [${title}] 创建成功！`, "success");
            // 刷新左侧菜单
            await refreshSidebarMenu();
            // 关闭当前 Tab 并跳转到新表
            closeTab(null, 'create-table');
            openNewTab(id, title, 'table');
        } catch (err) {
            showMsg("创建失败: " + err.message, "error");
        }
    }
    //--------------------------------------------------
    // *************************************************
    //--------------------------------------------------


    //--------------------------------------------------
    //  表结构管理 修改表名/字段 删除 功能
    //--------------------------------------------------
    async function renderSchemaManageUI() {
        const schemas = await getAllSchemas();
        let html = `
            <div class="module-card">
                <div class="header-with-btn">
                    <h3>📝 表结构管理</h3>
                    <button class="btn-confirm" onclick="openNewTab('create-table', '创建新表格', 'module')">➕ 新建表</button>
                </div>
                <table class="main-table manage-table">
                    <thead>
                        <tr>
                            <th>显示名称</th>
                            <th>唯一 ID</th>
                            <th>列数量</th>
                            <th style="text-align:center;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${schemas.map(s => `
                            <tr>
                                <td><strong>${s.title}</strong></td>
                                <td><code>${s.id}</code></td>
                                <td>${s.columns.length}</td>
                                <td style="text-align:center;">
                                    <button class="btn-edit" onclick="openEditSchemaModal('${s.id}')">修改字段</button>
                                    <button class="btn-danger" onclick="handleDeleteTable('${s.id}', '${s.title}')">删除</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        $('#tabContent').html(html);
    }

    // 1. 打开弹窗 修改表结构并填充数据
    async function openEditSchemaModal(id) {
        try {
            const schemas = await getAllSchemas(); // 确保 db.js 中有此函数
            const target = schemas.find(s => s.id === id);
            
            if (!target) {
                showMsg("找不到该表结构信息", "error");
                return;
            }

            // 填充数据到弹窗
            $('#editSchemaId').val(target.id);
            $('#editSchemaTitle').val(target.title);
            $('#editSchemaColumns').val(target.columns.join('\n'));
            
            // 显示弹窗 (使用 Flex 居中)
            $('#modalEditSchema').css('display', 'flex').fadeIn(200);
        } catch (err) {
            console.error("加载结构失败:", err);
        }
    }
    // 2. 处理 修改保存表结构逻辑
    async function handleSaveSchema() {
        const id = $('#editSchemaId').val();
        const newTitle = $('#editSchemaTitle').val().trim();
        const colsRaw = $('#editSchemaColumns').val();
    
        const newCols = parseColumns(colsRaw); // 使用新解析逻辑

        if (!newTitle || newCols.length === 0) {
            showMsg("(左侧侧菜单)名称和字段不能为空", "error");
            return;
        }

        try {
            // 调用数据库更新函数
            await updateTableSchema(id, newTitle, newCols); 
            
            showMsg("表结构修改成功", "success");
            $('#modalEditSchema').fadeOut(200);
            
            // 刷新界面
            await refreshSidebarMenu(); // 刷新左侧菜单
            renderSchemaManageUI();    // 刷新当前的表格管理列表
            
        } catch (err) {
            showMsg("修改失败: " + err, "error");
        }
    }

    async function handleDeleteTable(id, title) {
        // 使用自定义弹窗
        const confirmed = await showConfirm(`⚠️ 危险操作！\n确定要彻底删除表格 [${title}] 吗？删除后不可恢复(最好 数据库导出备份)！`, '删除确认');
        if (confirmed) {
            try {
                await deleteTable(id); 
                showMsg("表格已安全删除", "success");
                
                // --- 这里的逻辑要改 ---
                // 查找是否存在该 ID 的标签（确保 id 是字符串匹配）
                const tabExists = window.openTabs.some(t => String(t.id) === String(id));
                
                if (tabExists) {
                    closeTab(null, id); 
                }
                
                await refreshSidebarMenu();
                renderSchemaManageUI(); 
                
            } catch (err) {
                showMsg("删除失败", "error");
            }
        }
    }
    //--------------------------------------------------
    // *************************************************
    //--------------------------------------------------

    //--------------------------------------------------
    // 右侧 tabpanel 切换  功能
    //--------------------------------------------------

    //右侧 tabpanel 的切换
    // 1. 修改打开标签的函数，支持存储类型
    async function openNewTab(id, title, type) {
        let existingTab = window.openTabs.find(t => t.id === id);
        if (!existingTab) {
            // 将类型 (type) 也存入标签对象中
            window.openTabs.push({ id, title, type });
        }
        
        currentActiveTableId = id;
        renderTabStrip();
        
        // 调用分流器进行渲染
        renderTabContent(id, title, type);
    }
     // 2. 新增分流渲染函数
    //这里是左侧菜单点击渲染右侧界面的分流渲染函数 
    async function renderTabContent(id, title, type) {
        // 每次渲染前，先确保 #tabContent 是干净的
        $('#tabContent').empty();
        if (type === 'table') {
            // 如果是已开发的表格功能,这里传入true强制从数据库刷新
            await renderTableView(id); 
        } else {
            // --- 针对特定模块 ID 进行分流 ---
            switch(id) {
                case 'create-table':
                    renderCreateTableUI(); // 执行创建表格的界面渲染
                    break;
                case 'schema-manage':
                    renderSchemaManageUI(); // 执行表结构管理的界面渲染
                    break;
                case 'backup-restore':
                    renderRestoreUI(); // 执行 数据库备份还原 的界面渲染
                    break;
                case 'processing':
                    renderProcessingModule('tabContent'); // 导航 表格数据处理 
                    break;
                case 'staff-accommodation':
                    staffAccommodationModule('tabContent'); // 导航 表格数据处理 
                    break;
                case 'backup-export':
                    backupExportUI(id, title); // 执行 数据库备份还原 的界面渲染
                    break;
                default:
                    renderPlaceholderView(id, title); // 其他没做的模块显示“开发中”
            }
        }
    }   
    // 3. 专门负责“正在开发中”的渲染函数
    function renderPlaceholderView(id, title) {
        const html = `
            <div class="placeholder-view">
                <div class="placeholder-content">
                    <div class="placeholder-icon">🛠️</div>
                    <h2>${title} 模块</h2>
                    <p>功能正在全力开发中，敬请期待...</p>
                    <div class="placeholder-id">模块标识: ${id}</div>
                    <button class="btn-confirm" onclick="closeTab(event, '${id}')">关闭此页</button>
                </div>
            </div>
        `;
        $('#tabContent').html(html);
    }

    //全库数据导出展示 渲染的界面
    function backupExportUI(id, title) {
        // 异步获取一下当前有多少张表，增加交互感
        getAllSchemas().then(schemas => {
            const tableCount = schemas.length;
            
            const html = `
                <div class="module-card export-module">
                    <div class="module-header">
                        <div class="module-title">
                            <span class="icon">📤</span>
                            <h2>${title}</h2>
                        </div>
                    </div>
                    
                    <div class="module-body">
                        <div class="export-status-card">
                            <div class="status-item">
                                <span class="label">当前数据库状态</span>
                                <span class="value">就绪 (Ready)</span>
                            </div>
                            <div class="status-item">
                                <span class="label">包含表格总数</span>
                                <span class="value">${tableCount} 张</span>
                            </div>
                            <div class="status-item">
                                <span class="label">导出格式</span>
                                <span class="value">JSON (已优化体积)</span>
                            </div>
                        </div>

                        <div class="export-instructions">
                            <h4>💡 导出说明：</h4>
                            <ul>
                                <li>系统将打包所有<strong>表结构 (Schema)</strong> 和 <strong>数据内容 (Data)</strong>。</li>
                                <li>导出的文件可用于系统重装后的“数据库还原”。</li>
                                <li>建议定期备份数据，并存储在非系统盘或云端。</li>
                            </ul>
                        </div>

                        <div class="export-action-zone">
                            <button class="btn-export-large" onclick="handleFullDatabaseExport()">
                                <span class="icon">🚀</span> 立即生成全库备份文件
                            </button>
                            <p class="export-tip">文件将通过浏览器自动下载到您的本地文件夹</p>
                        </div>
                    </div>
                </div>
            `;
            $('#tabContent').html(html);
        });
    }

    // --- 2. 渲染标签栏 ---
    function renderTabStrip() {
        const html = window.openTabs.map(t => `
            <li class="tab-item ${currentActiveTableId === t.id ? 'active' : ''}" data-id="${t.id}">
                <span>${t.title}</span>
                <i class="close-tab" data-id="${t.id}">&times;</i>
            </li>
        `).join('');
        $('#tabStrip').html(html);
    }

    // --- 3. 切换标签页 ---
    async function switchTab(id) {
        currentActiveTableId = id;
    
        // 1. 刷新标签栏的 CSS 高亮状态
        renderTabStrip(); 
        
        // 2. 从已打开的标签数组中获取该标签的详细信息 (title, type)
        const tabInfo = window.openTabs.find(t => t.id === id);
        
        if (tabInfo) {
            // 3. 调用统一的渲染入口
            renderTabContent(tabInfo.id, tabInfo.title, tabInfo.type);
        } else {
            console.warn("未找到标签信息，可能已被关闭");
        }
    }

    // --- 4. 关闭标签页 ---
    $(document).on('click', '.close-tab', async function(e) {
        e.stopPropagation(); // 防止触发 switchTab
        const id = $(this).data('id');
        
        // 检查是否有未保存修改（红字）
        if ($(`#container-${id} .is-modified`).length > 0) {
            const confirmed = await showConfirm(
                "该表格有未保存的修改，直接关闭将丢失修改，确定关闭吗？", 
                "警告"
            );
            if (!confirmed) return;

            // --- 【新增：清理内存逻辑】 ---
            // 检查并删除该表格在内存中的所有临时数据
            if (window.tableEditRegistry && window.tableEditRegistry[id]) {
                delete window.tableEditRegistry[id];
            }
            if (window.tableOriginalRegistry && window.tableOriginalRegistry[id]) {
                delete window.tableOriginalRegistry[id];
            }
            if (window.tableViewRegistry && window.tableViewRegistry[id]) {
                delete window.tableViewRegistry[id];
            }
            console.log(`已释放表格 ${id} 的内存数据`);
            // ----------------------------
        }

        // 从列表中移除
        window.openTabs = window.openTabs.filter(t => t.id !== id);
        
        // 如果关闭的是当前激活的，切换到最后一个标签或显示欢迎页
        if (currentActiveTableId === id) {
            if (window.openTabs.length > 0) {
                switchTab(window.openTabs[window.openTabs.length - 1].id);
            } else {
                currentActiveTableId = null;
                $('#tabContent').html('<div class="welcome-screen"><h3>欢迎使用管理系统</h3></div>');
            }
        }
        
        renderTabStrip();
    });



    // 修改后的关闭标签函数
    function closeTab(e, id) {
        console.log(`仅来了 ${id} 的内存数据`);

        // 1. 如果有事件对象，阻止冒泡（防止触发 switchTab）
        if (e) {
            e.stopPropagation();
        }

        // 2. 从数组中移除
        const index = window.openTabs.findIndex(t => t.id === id);
        if (index === -1) return;

        window.openTabs.splice(index, 1);

        // 3. 处理激活状态的转移
        if (currentActiveTableId === id) {
            if (window.openTabs.length > 0) {
                // 如果关掉的是当前页，自动跳到最后一个标签
                currentActiveTableId = window.openTabs[window.openTabs.length - 1].id;
            } else {
                currentActiveTableId = null;
            }
        }

        // 4. 重新渲染 UI
        renderTabStrip();
        
        // 5. 根据剩余标签情况渲染内容
        if (currentActiveTableId) {
            const nextTab = window.openTabs.find(t => t.id === currentActiveTableId);
            renderTabContent(nextTab.id, nextTab.title, nextTab.type);
        } else {
            // 如果标签全关了，显示欢迎界面
            renderWelcomeScreen();
        }
    }
    function renderWelcomeScreen() {
        $('#tabContent').html(`
            <div class="welcome-screen">
                <h3>👋 欢迎使用管理系统</h3>
                <p>表格已关闭或已被删除，请从左侧菜单重新选择。</p>
            </div>
        `);
    }
    //右侧 tabpanel 的切换 结束
    //--------------------------------------------------
    // *************************************************
    //--------------------------------------------------

// --- 安全关闭弹窗的逻辑 新增数据 按钮 ---
async function safeCloseDataModal() {
    let hasData = false;
    $('#dataEntryForm .data-input').each(function() {
        if ($(this).val().trim() !== "") {
            hasData = true;
            return false;
        }
    });

    if (hasData) {
        // 有数据时点击背景，会弹出你要求的美化确认框
        const confirmed = await showConfirm("您已经输入了内容，现在关闭将丢失数据，确定要离开吗？", "放弃录入？");
        if (!confirmed) return; 
    }

    $('#dataEntryModal').hide();
    $('#dataEntryForm')[0].reset(); // 关闭时彻底重置表单
}

// --- 1. 核心保存函数 (必须放在全局，HTML 里的 onclick 才能找到它) ---
// --- 核心保存函数 修复版 ---
async function handleBulkSave(tableId) {
    const confirmed = await showConfirm(
        `您正在修改表格 [${tableId}] 的数据。确定保存当前所有修改吗？`, 
        "保存确认"
    );

    if (confirmed) {
        try {
            // 【关键修改】：读取 tableEditRegistry 而不是 tableDataRegistry
            const dataToSave = window.tableEditRegistry[tableId];
            
            if (!dataToSave || dataToSave.length === 0) {
                // 如果是空，可能是还没加载好，做一个保护
                const full = await getTableFullData(tableId);
                if (full.data.length > 0) {
                    showMsg("保存异常：内存数据丢失，请刷新页面重试", "error");
                    return;
                }
            }

            // 调用 db.js 中的函数持久化到 IndexedDB
            await updateTableAllData(tableId, dataToSave);
            
            showMsg("保存成功！数据已持久化。", "success");
            
            // 【重要】：保存成功后，同步原始注册表，使红字消失
            window.tableOriginalRegistry[tableId] = JSON.parse(JSON.stringify(dataToSave));
            
            // 重新渲染，此时 hasChanges(tableId) 会返回 false，保存按钮会自动隐藏
            renderTableView(tableId); 
        } catch (err) {
            console.error(err);
            showMsg("保存失败: " + err, "error");
        }
    }
}
// --- 2. 渲染视图函数 (也建议放在全局) ---
// --- 4. 核心渲染函数 ---
async function renderTableView(tableId) {
    const $container = $('#tabContent');
    if ($container.length === 0) return;

    // 1. 获取最新数据库数据
    const fullData = await getTableFullData(tableId);
    if (!fullData || !fullData.schema) return;
    
    const dbData = fullData.data || [];

    // 初始化大容器
    window.tableOriginalRegistry = window.tableOriginalRegistry || {};
    window.tableEditRegistry = window.tableEditRegistry || {};

    // --- 核心改进：严谨的同步逻辑 ---
    // 如果内存中还没有数据，或者数据库长度发生了变化（新增了行）
    // --- 核心改进：逻辑判断 ---
    const isNoMemory = !window.tableEditRegistry[tableId];
    const lengthChanged = window.tableEditRegistry[tableId]?.length !== dbData.length;

    if (isNoMemory || lengthChanged) {
        // 只有在长度变化或首次加载时才强制覆盖内存，防止编辑到一半被重置
        window.tableOriginalRegistry[tableId] = JSON.parse(JSON.stringify(dbData));
        window.tableEditRegistry[tableId] = JSON.parse(JSON.stringify(dbData));
    }

    // 2. 无论有没有修改，渲染前都重新构建一次视图数据（处理排序）
    rebuildViewData(tableId);

    const schema = fullData.schema;
    const activeData = window.tableViewRegistry[tableId] || [];
    const referenceData = window.tableOriginalRegistry[tableId] || [];

    // 在生成 html 变量之前，先生成 rowsHtml
    const rowsHtml = renderTableBody(tableId, activeData, referenceData, schema);

    let html = `
        <div class="table-container" id="container-${tableId}">
            <div class="table-toolbar">
                <div class="table-title-box">
                    <span class="table-icon">📊</span>
                    <h2>${schema.title}<span class="table-id-tag">(${tableId})</span></h2>
                </div>
                <div class="table-actions">
                    <button class="btn-confirm" style="background:#2ecc71" onclick="toggleSearchRow('${tableId}')">🔍 搜索过滤</button>
                    <button class="btn-save-changes" id="btn-save-${tableId}" 
                            onclick="handleBulkSave('${tableId}')" 
                            style="${hasChanges(tableId) ? 'display:inline-block' : 'display:none'}">💾 保存修改</button>
                    <button class="btn-confirm" onclick="openAddDataModal('${tableId}')">➕ 新增数据</button>
                    <button class="btn-confirm" onclick="$('#excel-upload-${tableId}').click()">📥 导入 Excel</button>
                    <input type="file" id="excel-upload-${tableId}" style="display:none" 
                           accept=".xlsx, .xls" 
                           onchange="importExcelToTable(this.files[0], '${tableId}')">
                    <button class="btn-confirm" onclick="openExportConfig('${tableId}')" style="background:#9b59b6">📤 导出 Excel</button>
                    <button class="btn-delete-all" onclick="clearAllTableData('${tableId}')">🧹 清空所有数据</button>

                </div>
            </div>
            <div class="search-bar-container" id="search-bar-${tableId}" style="display:none;">
                <div class="search-input-group">
                    <span class="search-icon">🔎</span>
                    <input type="text" 
                           class="search-input" 
                           id="filter-input-${tableId}" 
                           placeholder="输入任意关键字搜索..." 
                           oninput="handleSearch('${tableId}')">
                    <button class="btn-close-search" onclick="toggleSearchRow('${tableId}', true)">✕</button>
                </div>
                <div class="search-stat" id="search-stat-${tableId}"></div>
            </div>
            <div class="table-responsive">
                <table class="main-table">
                    <thead>
                        <tr>
                            <th style="width:50px">操作</th>
                            <th style="width:50px">#</th>
                            ${schema.columns.map((c, i) => 
                                `<th class="sortable-th" data-table="${tableId}" data-col="${i + 1}">
                                    ${c}<span class="sort-icon"></span>
                                 </th>`
                            ).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
        <div class="row-detail-panel" id="detail-panel-${tableId}">
            <div class="detail-container">
                <h4 class="detail-header">点击行查看完整详情</h4>
            </div>
        </div>
    `;


    
    $container.html(html);
    updateSortIcons(tableId);
}

//从上面的 renderTableView(tableId) 核心渲染 抽离出来的数据行的渲染
// 新增函数：专门负责生成 tbody 内部的 HTML
function renderTableBody(tableId, activeData, referenceData, schema) {
    if (!activeData || activeData.length === 0) {
        return `<tr><td colspan="100" style="text-align:center; padding:30px; color:#999;">暂无匹配数据</td></tr>`;
    }

    return activeData.map((row, rIdx) => {
        const rowUniqueId = row[0]; 
        const businessData = row.slice(1);
        const originalRow = referenceData.find(r => r[0] === rowUniqueId);

        return `
            <tr data-row-id="${rowUniqueId}">
                <td class="row-actions">
                    <button class="btn-delete-row" onclick="deleteSingleRow('${tableId}', '${rowUniqueId}')" title="删除此行">🗑️</button>
                </td>
                <td class="row-index">${rIdx + 1}</td>
                ${businessData.map((cell, cIdx) => {
                    const realColIdx = cIdx + 1;
                    const oldVal = originalRow ? originalRow[realColIdx] : cell;
                    // 统一转字符串对比
                    const isChanged = String(cell || '').trim() !== String(oldVal || '').trim();

                    return `<td class="editable-cell ${isChanged ? 'is-modified' : ''}" 
                                data-table="${tableId}" 
                                data-row-id="${rowUniqueId}" 
                                data-col="${realColIdx}" 
                                data-original="${oldVal || ''}">${cell || ''}</td>`;
                }).join('')}
            </tr>`;
    }).join('');
}

//排序状态图标同步函数
function updateSortIcons(tableId) {
    const state = window.tableSortState?.[tableId];
    const $ths = $(`#container-${tableId} .sortable-th`);

    // 清除所有样式
    $ths.removeClass('sort-asc sort-desc');

    if (state && state.direction) {
        // 根据当前的列和方向，找到对应的 TH 并添加类
        const activeTh = $ths.filter(`[data-col="${state.colIndex}"]`);
        if (state.direction === 'asc') {
            activeTh.addClass('sort-asc');
        } else if (state.direction === 'desc') {
            activeTh.addClass('sort-desc');
        }
    }
}


//核心排序函数
function applySortAndRender(tableId) {
    // 1. 确保全局容器存在
    window.tableEditRegistry = window.tableEditRegistry || {};
    
    // 2. 获取数据源（必须和 renderTableView 里的变量名一致）
    let data = window.tableEditRegistry[tableId]; 

    // 3. 【防错检查】如果数据还没加载出来，就不执行排序
    if (!data || !Array.isArray(data)) {
        console.error(`排序失败：window.tableEditRegistry["${tableId}"] 中没有数据`);
        return;
    }

    // 4. 调用你写的重建视图函数（它会处理具体的排序算法）
    // 这个函数会根据 window.tableSortState 自动排列数据，并存入 tableViewRegistry
    if (typeof rebuildViewData === 'function') {
        rebuildViewData(tableId);
    } else {
        // 如果你没定义 rebuildViewData，这里提供一个备用排序逻辑
        const state = window.tableSortState[tableId];
        if (state && state.direction) {
            const { colIndex, direction } = state;
            data.sort((a, b) => {
                const v1 = a[colIndex] ?? '';
                const v2 = b[colIndex] ?? '';
                const n1 = parseFloat(v1), n2 = parseFloat(v2);
                if (!isNaN(n1) && !isNaN(n2)) {
                    return direction === 'asc' ? n1 - n2 : n2 - n1;
                }
                return direction === 'asc' 
                    ? v1.toString().localeCompare(v2.toString(), 'zh') 
                    : v2.toString().localeCompare(v1.toString(), 'zh');
            });
        }
    }

    // 5. 重新触发渲染
    renderTableView(tableId);
}


// 辅助函数：检查某个表是否有修改
function hasChanges(tableId) {
    // const active = JSON.stringify(window.tableDataRegistry[tableId]);
    // const original = JSON.stringify(window.tableOriginalRegistry[tableId]);
    // return active !== original;
    const hasChange =
    JSON.stringify(window.tableEditRegistry[tableId]) !==
    JSON.stringify(window.tableOriginalRegistry[tableId]);
    return hasChange;
}


/**
 * 自定义确认框函数
 * @param {string} msg 提示内容
 * @param {string} title 标题
 * @returns {Promise<boolean>} 返回一个 Promise，点击确定为 true，取消为 false
 */
function showConfirm(msg, title = '确认操作') {
    return new Promise((resolve) => {
        const $modal = $('#confirmModal');
        $('#confirmTitle').text(title);
        $('#confirmMessage').text(msg);

        $modal.css('display', 'flex');

        // 绑定确定按钮
        $('#confirmBtnOk').off('click').on('click', function() {
            $modal.hide();
            resolve(true);
        });

        // 绑定取消按钮和 X 按钮
        $('#confirmBtnCancel, .close-modal').off('click').on('click', function() {
            $modal.hide();
            resolve(false);
        });
    });
}
/**
 * 公共消息提示函数
 * @param {string} msg 提示内容
 * @param {string} type 类型: success, error, info
 */
function showMsg(msg, type = 'info') {
    const $container = $('#toast-container');
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    
    // 创建一个 Toast 元素
    const $toast = $(`
        <div class="toast ${type}">
            <span style="margin-right:10px">${icons[type]}</span>
            <span>${msg}</span>
        </div>
    `);

    // 添加到容器中
    $container.append($toast);

    // 3秒后自动移除
    setTimeout(() => {
        $toast.remove();
    }, 3000);
}
// 动态加载左侧表格查看列表
async function loadTableList() {
    const $tableMenu = $('#tableMenu');
    // 这里将来会从 IndexedDB 读取 schemas 存储桶
    const demoTables = [
        {id: 'emp_base', title: '员工基本信息'},
        {id: 'emp_salary', title: '薪资管理表'},
        {id: 'emp_check', title: '每日考勤记录'}
    ];

    const html = demoTables.map(tb => `
        <li class="nav-link" data-id="${tb.id}">
            <span class="icon">📄</span><span class="menu-text">${tb.title}</span>
        </li>
    `).join('');
    
    $tableMenu.html(html);
}

// 切换右侧视图的占位函数
// 修改后的函数：在当前的 Tab 内部显示占位内容
function switchView(id, title) {
    // 1. 依然先调用 openNewTab，确保标签栏有这个标签
    openNewTab(id, title);
    
    // 2. 将提示内容注入到 #tabContent，而不是覆盖 #mainView
    $('#tabContent').html(`
        <div class="view-content">
            <h2>${title}</h2>
            <hr>
            <div class="alert alert-info">
                <p>🚀 模块 [${id}] 正在努力开发中...</p>
                <p>您可以先操作其他已开放的表格模块。</p>
            </div>
        </div>
    `);
}

// 刷新左侧“表格数据查看”菜单
async function refreshSidebarMenu() {
    const schemas = await getAllSchemas();
    const $menu = $('#tableMenu');
    
    if (schemas.length === 0) {
        // 保持样式一致
        $menu.html('<li style="padding:10px 25px; font-size:12px; color:#95a5a6; font-style:italic;">暂无表格数据</li>');
        return;
    }

    // 核心改进：添加 data-title 属性
    const html = schemas.map(s => `
        <li class="nav-link" 
            data-id="${s.id}" 
            data-type="table" 
            data-title="${s.title}">
            <span class="icon">📄</span><span class="menu-text">${s.title}</span>
        </li>
    `).join('');
    
    $menu.html(html);
}

//表格新增一条数据弹框
async function openAddDataModal(tableId) {
    console.log("正在准备新增数据，表ID:", tableId);
    
    try {
        // 1. 获取表结构信息
        const schemas = await getAllSchemas();
        const schema = schemas.find(s => s.id === tableId);
        
        if (!schema) {
            showMsg("无法识别表格信息", "error");
            return;
        }
        const colCount = schema.columns.length;
        const $modalContent = $('#dataEntryModal .modal-content');

        // --- 动态调整弹窗尺寸 ---
        if (colCount <= 5) {
            // 4列以内：窄弹窗，强制单列或双列
            $modalContent.css('width', '500px');
        } else if (colCount <= 12) {
            // 中等数量：800px 宽度
            $modalContent.css('width', '800px');
        } else {
            // 大量数据（如30列）：1100px 宽度，利用 auto-fill 实现 3-4 列
            $modalContent.css('width', '1000px');
        }

        // 2. 设置弹窗标题中的表名
        $('#entryTableTitle').text(schema.title);

        // 3. 动态生成表单
        // 我们利用 CSS Grid 布局，如果是 1000px 宽的弹窗，做成两列显示会很漂亮
        let formHtml = '<div class="form-grid-container">';
        schema.columns.forEach((col, index) => {
            formHtml += `
                <div class="form-group-item">
                    <label title="${col}">${col}</label> <input type="text" 
                           class="form-control data-input" 
                           data-index="${index}" 
                           placeholder="${col}..."
                           autocomplete="off">
                </div>
            `;
        });
        formHtml += '</div>';

        // 4. 填充并展示
        $('#dataEntryForm').html(formHtml);
        
        // 将当前操作的 tableId 绑定到保存按钮上，方便后续提取
        $('#saveDataRowBtn').data('table-id', tableId);
        // 重置滚动条位置到顶部
        $('.modal-body').scrollTop(0);
        
        $('#dataEntryModal').css('display', 'flex').fadeIn(200);

    } catch (err) {
        console.error("加载新增界面失败:", err);
        showMsg("界面初始化失败", "error");
    }
}


//单表导出功能
//加入新增按钮上面
//<button class="btn-export" onclick="handleExportTable('${tableId}')">📥 导出数据</button>
async function handleExportTable(tableId) {
    try {
        // 1. 获取打包好的数据
        const exportObj = await prepareExportData(tableId);
        const fileName = `${exportObj.title}_备份_${new Date().getTime()}.json`;
        
        // 2. 将对象转换为 JSON 字符串
        const jsonStr = JSON.stringify(exportObj, null, 2); // null, 2 表示格式化输出，方便阅读
        
        // 3. 创建 Blob 对象（二进制大对象）
        const blob = new Blob([jsonStr], { type: "application/json" });
        
        // 4. 利用虚拟链接触发浏览器下载
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        
        // 5. 清理现场
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showMsg(`表格 [${exportObj.title}] 导出成功！`, "success");
    } catch (err) {
        showMsg("导出失败: " + err.message, "error");
    }
}

// yuangong.js 全库导出备份，如 全库备份_20260112_1920.json
async function handleFullDatabaseExport() {
    try {
        showMsg("正在生成优化格式的备份...", "info");
        const fullBackup = await prepareFullBackup();
        
        // --- 核心改进：手动构建“一行一条数据”的 JSON 字符串 ---
        let jsonParts = [];
        
        // 1. 头部系统信息 (美化格式)
        jsonParts.push('{');
        jsonParts.push(`  "system": "${fullBackup.system}",`);
        jsonParts.push(`  "version": "${fullBackup.version}",`);
        jsonParts.push(`  "exportTime": "${fullBackup.exportTime}",`);
        jsonParts.push(`  "timestamp": ${fullBackup.timestamp},`);
        jsonParts.push('  "tables": [');

        // 2. 遍历每一张表
        fullBackup.tables.forEach((table, tIdx) => {
            jsonParts.push('    {');
            
            // 表结构 (Schema) 部分：保持展开，方便阅读
            const schemaJson = JSON.stringify(table.schema, null, 2).replace(/\n/g, '\n      ');
            jsonParts.push(`      "schema": ${schemaJson},`);
            
            // 表数据 (Data) 部分：一行一条记录
            jsonParts.push('      "data": [');
            table.data.forEach((row, rIdx) => {
                const isLastRow = rIdx === table.data.length - 1;
                // 将每一行数组转成紧凑 JSON 字符串
                jsonParts.push(`        ${JSON.stringify(row)}${isLastRow ? '' : ','}`);
            });
            jsonParts.push('      ]');
            
            const isLastTable = tIdx === fullBackup.tables.length - 1;
            jsonParts.push(`    }${isLastTable ? '' : ','}`);
        });

        jsonParts.push('  ]');
        jsonParts.push('}');

        // 将所有部分组合
        const finalJsonStr = jsonParts.join('\n');

        // 3. 执行下载
        const now = new Date();
        const timeStr = now.getFullYear() + 
                        String(now.getMonth() + 1).padStart(2, '0') + 
                        String(now.getDate()).padStart(2, '0') + "_" +
                        String(now.getHours()).padStart(2, '0') + 
                        String(now.getMinutes()).padStart(2, '0');
        const fileName = `全库备份_${timeStr}.json`;
        
        const blob = new Blob([finalJsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        URL.revokeObjectURL(url);
        showMsg(`导出成功！格式已优化。`, "success");
        
    } catch (err) {
        showMsg("导出失败: " + err.message, "error");
    }
}
//全库数据还原  暂时没用到
async function handleFullDatabaseRestore(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const backup = JSON.parse(e.target.result);
            if (backup.system !== "YuangongManagementSystem") {
                throw new Error("不是有效的备份文件");
            }

            const confirmed = confirm(`确定要还原备份吗？这将覆盖当前 所有数据！\n备份时间：${backup.exportTime}`);
            if (!confirmed) return;

            // 这里调用 db.js 里的全量覆盖函数 (稍后写)
            await restoreFullDatabase(backup.tables);
            
            showMsg("数据还原成功！页面即将刷新。", "success");
            setTimeout(() => location.reload(), 1500);
        } catch (err) {
            showMsg("还原失败: " + err.message, "error");
        }
    };
    reader.readAsText(file);
}

async function startRestore() {
    const file = $('#fileInput')[0].files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const backup = JSON.parse(e.target.result);
            
            // 校验文件格式
            if (backup.system !== "YuangongManagementSystem") {
                throw new Error("无效的备份文件格式！");
            }

            // --- 核心修改：使用你的自定义 showConfirm ---
            const confirmed = await showConfirm(
                `确定要还原备份吗？这将覆盖当前所有数据！\n备份时间：${backup.exportTime}\n包含表格数：${backup.tables.length} 个`,
                '危险：数据库还原'
            );

            if (!confirmed) return;

            showMsg("正在还原数据...", "info");
            await restoreFullDatabase(backup.tables);
            showMsg("数据还原成功！系统即将重载...", "success");
            
            setTimeout(() => { location.reload(); }, 2000);

        } catch (err) {
            showMsg("还原失败：" + err.message, "error");
        }
    };
    reader.readAsText(file);
}


// 当点击导航栏“数据还原”时调用 渲染出界面先
function renderRestoreUI() {
    const html = `
        <div class="module-card">
            <h3>📥 数据库还原</h3>
            <div class="restore-zone" id="restoreZone">
                <div class="restore-icon">📂</div>
                <p>点击或拖拽备份文件 (.json) 到此处</p>
                <input type="file" id="fileInput" accept=".json" style="display:none">
                <button class="btn-confirm" onclick="$('#fileInput').click()">选择备份文件</button>
            </div>
            <div id="fileInfo" style="margin-top:20px; display:none;">
                <p>准备还原文件: <strong id="readyFileName"></strong></p>
                <p style="color:red;">⚠️ 警告：还原操作将永久覆盖当前数据库中的所有表格和数据！</p>
                <button class="btn-danger" onclick="startRestore()">立即开始还原</button>
            </div>
        </div>
    `;
    $('#tabContent').html(html);

    // 绑定文件选择事件
    $('#fileInput').on('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            $('#readyFileName').text(file.name);
            $('#fileInfo').fadeIn();
        }
    });
}

//排序只作用在“展示数据”
function rebuildViewData(tableId) {
    // 1. 防御初始化：确保 Registry 对象存在，防止 Cannot set properties of undefined 报错
    window.tableEditRegistry = window.tableEditRegistry || {};
    window.tableViewRegistry = window.tableViewRegistry || {};

    if (!window.tableEditRegistry[tableId]) {
        window.tableEditRegistry[tableId] = [];
    }

    // 2. 始终从“当前的编辑状态”克隆一份数据用于排序显示
    const editData = window.tableEditRegistry[tableId];
    let viewData = [...editData];

    // 3. 执行排序
    const state = window.tableSortState?.[tableId];
    if (state?.direction) {
        const { colIndex, direction } = state;

        viewData.sort((a, b) => {
            // 【关键点】：a 和 b 是整行数组 [ID, 姓名, 年龄...]
            // 页面上传来的 colIndex 是渲染时的 data-col，它已经包含了 ID 的偏移
            // 所以这里直接用 a[colIndex] 是正确的，但要确保传参一致
            const v1 = a[colIndex] ?? '';
            const v2 = b[colIndex] ?? '';
            
            // 数字排序增强：如果是数字则按大小排，否则按中文字符排
            const n1 = parseFloat(v1), n2 = parseFloat(v2);
            if(!isNaN(n1) && !isNaN(n2)) {
                return direction === 'asc' ? n1 - n2 : n2 - n1;
            }

            return direction === 'asc'
                ? v1.toString().localeCompare(v2.toString(), 'zh')
                : v2.toString().localeCompare(v1.toString(), 'zh');
        });
    }

    // 4. 将排好序的结果存入视图注册表
    window.tableViewRegistry[tableId] = viewData;
}

/**
 * 导入 Excel：支持 Sheet 选择 + 追加/覆盖模式
 * @param {File} file 用户选择的文件
 * @param {string} tableId 目标表 ID
 */
async function importExcelToTable(file, tableId) {
    if (!file) return;
    console.log("1. 开始导入流程", file.name);

    const fileInput = document.getElementById(`excel-upload-${tableId}`);
    const reader = new FileReader();

    reader.onload = async function(e) {
        console.log("2. 文件读取完成");
        try {
            const data = new Uint8Array(e.target.result);
            if (typeof XLSX === 'undefined') throw new Error("未找到 XLSX 插件");

            const workbook = XLSX.read(data, { type: 'array' });
            const sheetNames = workbook.SheetNames;

            if (!sheetNames || sheetNames.length === 0) {
                alert("Excel 文件中没有工作表");
                return;
            }

            // --- 第一步：动态选择工作表 (解决 4 个 Sheet 的问题) ---
            let selectedSheetName = sheetNames[0];
            if (sheetNames.length > 1) {
                console.log("3. 弹出 Sheet 选择器，总数:", sheetNames.length);
                selectedSheetName = await showSheetSelector(sheetNames);
                
                if (!selectedSheetName) {
                    console.log("用户取消了工作表选择");
                    return; 
                }
            }

            // --- 第二步：导入模式选择 (继续用你的三选一弹窗) ---
            console.log("4. 弹出模式选择", selectedSheetName);
            const modeResult = await showTripleChoice(
                '数据处理方式',
                `您准备如何将 [${selectedSheetName}] 的数据导入？`,
                '追加数据 (保留现有)',
                '覆盖数据 (清空现有)',
                '放弃导入'
            );

            if (!modeResult) {
                console.log("用户放弃了模式选择");
                return;
            }

            const importMode = (modeResult === 'choice1') ? 'append' : 'overwrite';
            console.log("5. 执行导入模式:", importMode);

            // --- 第三步：执行执行 ---
            await executeExcelImport(workbook, selectedSheetName, tableId, importMode);
            console.log("6. 导入成功");

        } catch (err) {
            console.error("崩溃详情:", err);
            alert("导入失败: " + err.message);
        } finally {
            if (fileInput) fileInput.value = ''; // 无论如何都清空，解决重复点击失效
        }
    };

    reader.readAsArrayBuffer(file);
}
// 动态检测sheet
function showSheetSelector(sheetNames) {
    return new Promise((resolve) => {
        const $modal = $('#sheetSelectModal');
        
        // 关键排查：如果找不到 DOM 元素，立刻报错
        if ($modal.length === 0) {
            console.error("致命错误：HTML 中缺少 #sheetSelectModal 元素！");
            alert("系统组件缺失，请检查 HTML 结构");
            resolve(null);
            return;
        }

        const $dropdown = $('#sheetDropdown');
        $dropdown.empty();
        sheetNames.forEach(name => {
            $dropdown.append(`<option value="${name}">${name}</option>`);
        });

        // 强制显示并置顶
        $modal.css({
            'display': 'flex',
            'z-index': '1000000'
        }).show();

        console.log("弹窗逻辑已触发，等待用户操作...");

        // 使用 .off().one() 确保干净的点击事件
        $('#sheetBtnConfirm').off('click').one('click', function() {
            const val = $('#sheetDropdown').val();
            console.log("用户点击确定，选中:", val);
            $modal.hide();
            resolve(val);
        });

        $('#sheetBtnCancel').off('click').one('click', function() {
            console.log("用户点击取消导入");
            $modal.hide();
            resolve(null);
        });
    });
}

/**
 * 执行数据解析并保存到数据库
 */
async function executeExcelImport(workbook, sheetName, tableId, mode) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) return alert(`工作表 [${sheetName}] 为空`);

    // 获取表结构
    const { schema } = await getTableFullData(tableId);

    // 5. 生成新数据行 (使用 UUID 确保唯一性)
    const newRows = jsonData.map(excelRow => {
        const uniqueId = 'uid_' + crypto.randomUUID();
        const businessData = schema.columns.map(colName => {
            const foundKey = Object.keys(excelRow).find(key => key.trim() === colName.trim());
            let value = foundKey ? excelRow[foundKey] : "";
            return value === null || value === undefined ? "" : String(value).trim();
        });
        return [uniqueId, ...businessData];
    });

    // 6. 处理追加或覆盖逻辑
    let finalData = [];
    if (mode === 'append') {
        const currentFullData = await getTableFullData(tableId);
        finalData = [...(currentFullData.data || []), ...newRows];
    } else {
        // 覆盖模式，直接使用新数据
        finalData = newRows;
    }

    // 7. 写入数据库
    await updateTableAllData(tableId, finalData);

    // 8. 同步内存，防止出现红字
    window.tableOriginalRegistry[tableId] = JSON.parse(JSON.stringify(finalData));
    window.tableEditRegistry[tableId] = JSON.parse(JSON.stringify(finalData));

    // 9. 刷新界面
    alert(`导入成功！共从 [${sheetName}] ${mode === 'append' ? '追加' : '覆盖'}了 ${newRows.length} 条数据`);
    renderTableView(tableId);
    
    // 同时也重置搜索框状态（如果开着的话）
    if ($(`#search-bar-${tableId}`).is(':visible')) {
        toggleSearchRow(tableId, true);
    }
}

/**
 * 删除单行数据
 */
async function deleteSingleRow(tableId, rowId) {
    // 使用你现有的确认模态框或简单的 confirm
    // if (!confirm("确定要删除这一行数据吗？删除后无法撤销。")) return;
    if (!await showConfirm("确定要删除这一行数据吗？删除后无法撤销。。。", "⚠️危险操作警告")) return;

    try {
        // 1. 从内存注册表中滤掉这一行
        const currentData = window.tableEditRegistry[tableId];
        const updatedData = currentData.filter(row => row[0] !== rowId);

        // 2. 更新数据库
        await updateTableAllData(tableId, updatedData);

        // 3. 同步原始数据注册表（防止删除后出现红字对比错误）
        window.tableOriginalRegistry[tableId] = JSON.parse(JSON.stringify(updatedData));
        window.tableEditRegistry[tableId] = updatedData;

        // 4. 重新渲染界面
        renderTableView(tableId);
        
        // 5. 如果右侧详情面板显示的是这一行，清空它
        $(`#detail-panel-${tableId}`).html('<div class="detail-empty-hint">行已删除</div>');

    } catch (error) {
        console.error("删除失败:", error);
        alert("删除失败，请查看控制台");
    }
};


// 对应的 JS 清空表所有数据
async function clearAllTableData(tableId) {
    if (!await showConfirm("确定要 删除表里面 所有数据吗？", "危险操作警告")) return;
    if (!await showConfirm("再次确认？ 删除了就没有数据了。。不过如果你有备份数据依然可以导入,否则你将失去所有数据。", "⚠️危险操作警告")) return;

    await updateTableAllData(tableId, []); // 传入空数组
    window.tableEditRegistry[tableId] = [];
    window.tableOriginalRegistry[tableId] = [];
    renderTableView(tableId);
};

//搜索框 接下来3个函数
// 切换搜索条显示/隐藏
window.toggleSearchRow = function(tableId, forceClose = false) {
    const $bar = $(`#search-bar-${tableId}`);
    const $input = $(`#filter-input-${tableId}`);

    // 如果是强制关闭，或者是当前可见（即点击按钮准备隐藏）
    if (forceClose || $bar.is(':visible')) {
        $bar.slideUp(200); // 向上滑动隐藏
        $input.val('');    // 【关键】清空输入框内容
        handleSearch(tableId); // 【关键】重置搜索逻辑，恢复显示表格全部数据
    } else {
        // 展开搜索框
        $bar.slideDown(200, function() {
            $input.focus(); // 展开后自动聚焦，方便直接打字
        });
    }
};

// 处理搜索过滤
window.handleSearch = function(tableId) {
    const keyword = $(`#filter-input-${tableId}`).val().toLowerCase().trim();
    
    // 从内存中获取全部数据和原始参考数据
    const allData = window.tableEditRegistry[tableId] || [];
    const refData = window.tableOriginalRegistry[tableId] || [];
    
    // 这里需要获取当前的 schema，如果全局没存，可以从 getTableFullData 异步取，
    // 或者建议你在 window.currentSchemas = {} 里存一份
    const schema = window.allSchemas ? window.allSchemas.find(s => s.id === tableId) : null;

    let displayData = allData;

    // 1. 如果有关键词，执行过滤
    if (keyword) {
        displayData = allData.filter(row => {
            // 跳过索引0(UID)，检查业务列是否包含关键词
            return row.slice(1).some(cell => 
                String(cell || '').toLowerCase().includes(keyword)
            );
        });
    }

    // 2. 调用刚才封装的函数生成 HTML
    const newBodyHtml = renderTableBody(tableId, displayData, refData, schema);

    // 3. 【核心修复】精准更新当前表格的 tbody
    $(`#container-${tableId} .main-table tbody`).html(newBodyHtml);

    // 4. 更新统计数字
    $(`#search-stat-${tableId}`).text(keyword ? `找到 ${displayData.length} 条结果` : '');
};

// 专门用于渲染过滤结果，不重绘整个表格，防止输入框失去焦点
function renderFilteredRows(tableId, data) {
    const $tbody = $(`#container-${tableId} .main-table tbody`);
    if (data.length === 0) {
        $tbody.html('<tr><td colspan="100" style="text-align:center;padding:20px;color:#999;">未找到匹配数据</td></tr>');
        return;
    }
    
    // 这里调用你原来的行生成逻辑，由于逻辑较多，建议把原来的行生成封装成一个函数
    // 暂时简单展示：
    const html = data.map((row, idx) => {
        // ... 这里的逻辑和你 renderTableView 里的 tbody 循环一模一样
        // 建议把那一长串 row.map 的代码提取出来复用
    }).join('');
    
    $tbody.html(html);
}

/**
 * 通用三按钮选择框
 * @returns {Promise<string|null>} 返回 'choice1', 'choice2' 或 null(取消)
 */
function showTripleChoice(title, msg, btn1Text, btn2Text, btnCancelText = '取消') {
    return new Promise((resolve) => {
        const $modal = $('#choiceModal');
        if ($modal.length === 0) {
            console.error("错误：找不到 ID 为 choiceModal 的弹窗元素！");
            resolve(null); 
            return;
        }

        $('#choiceTitle').text(title);
        $('#choiceMessage').text(msg);
        $('#choiceBtn1').text(btn1Text);
        $('#choiceBtn2').text(btn2Text);
        $('#choiceBtnCancel').text(btnCancelText);

        $modal.css('display', 'flex');

        // 使用 .one() 确保事件只触发一次，触发后自动销毁，防止逻辑堆叠
        $('#choiceBtn1').off('click').one('click', () => { $modal.hide(); resolve('choice1'); });
        $('#choiceBtn2').off('click').one('click', () => { $modal.hide(); resolve('choice2'); });
        $('#choiceBtnCancel').off('click').one('click', () => { $modal.hide(); resolve(null); });
    });
}
/**
 * 触发导出入口
 */
window.openExportConfig = async function(tableId) {
    console.log("尝试打开导出配置:", tableId);
    currentExportTableId = tableId;
    
    const fullData = await getTableFullData(tableId);
    const schema = fullData.schema;

    // 动态填充列选择下拉框
    const $colSelect = $('#highlightColIndex');
    $colSelect.empty();
    $colSelect.append('<option value="-1">不使用列高亮</option>');
    schema.columns.forEach((col, index) => {
        $colSelect.append(`<option value="${index}">${col}</option>`);
    });

    $('#exportConfigModal').css('display', 'flex').show();
};

/**
 * 3. 核心导出Excel函数
 */
async function startExportProcess() {
    const tableId = currentExportTableId;
    if (!tableId) return;

    try {
        if (typeof ExcelJS === 'undefined') {
            alert("ExcelJS 库尚未加载，请检查网络或引用路径！");
            return;
        }

        const config = {
            headerBg: $('#headerBgColor').val().replace('#', '').toUpperCase(),
            headerFont: $('#headerFontColor').val().replace('#', '').toUpperCase(),
            highlightIdx: parseInt($('#highlightColIndex').val()),
            highlightColor: $('#colHighlightColor').val().replace('#', '').toUpperCase(),
            autoWidth: $('#autoWidth').is(':checked')
        };

        $('#exportConfigModal').hide();
        console.log("正在准备数据...", config);

        const fullData = await getTableFullData(tableId);
        const data = window.tableEditRegistry[tableId] || fullData.data;
        const schema = fullData.schema;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(schema.title);

        // 添加表头
        const headerRow = worksheet.addRow(schema.columns);
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + config.headerBg } };
            cell.font = { 
                name: '微软雅黑', // 设置微软雅黑
                family: 2, 
                color: { argb: 'FF' + config.headerFont }, 
                bold: true,
                size: 11 
            };
            cell.alignment = { horizontal: 'center',vertical: 'middle' };
        });

        // 添加数据
        data.forEach(row => {
            const businessData = row.slice(1); // 排除内部UID
            const newRow = worksheet.addRow(businessData);

            // 遍历当前行所有单元格，设置默认字体
            newRow.eachCell((cell, colNumber) => {
                cell.font = {
                    name: '微软雅黑', // 数据行也使用微软雅黑
                    family: 2,
                    size: 10
                };
                cell.alignment = { vertical: 'middle', horizontal: 'left' }; // 居左对齐更符合阅读习惯

                // 处理你之前的【特定列高亮】逻辑
                if (config.highlightIdx !== -1 && (colNumber === config.highlightIdx + 1)) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF' + config.highlightColor }
                    };
                }
            });
        });

        // 6. 全局边框设置 (可选，加上边框会让 Excel 更像报表)
        worksheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
                };
            });
        });

        // 自动列宽
        if (config.autoWidth) {
            worksheet.columns.forEach(column => {
                let maxLen = 0;
                column.eachCell({ includeEmpty: true }, cell => {
                    const len = cell.value ? cell.value.toString().length : 10;
                    if (len > maxLen) maxLen = len;
                });
                column.width = maxLen + 5;
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `${schema.title}_导出.xlsx`);

    } catch (err) {
        console.error("导出失败详情:", err);
        alert("导出过程出错，请查看控制台。");
    }
}

//************** 临时数据
//************** 临时数据
//************** 临时数据
//************** 临时数据

// ${activeData.map((row, rIdx) => `
//                                 <tr>
//                                     <td>${rIdx + 1}</td>
//                                     ${row.map((cell, cIdx) => `
//                                         <td class="editable-cell" 
//                                             data-table="${tableId}" 
//                                             data-row="${rIdx}" 
//                                             data-col="${cIdx}" 
//                                             data-original="${cell || ''}">${cell || ''}</td>
//                                     `).join('')}
//                                 </tr>
//                             `).join('')}
//************** 临时数据
// 表格数据行数据 tbody里面的行数据】 现在抽离成单独的行渲染
// ${activeData.map((row, rIdx) => {
//                             const rowUniqueId = row[0]; // 你的 ID 逻辑
//                             const businessData = row.slice(1);
//                             const originalRow = referenceData.find(r => r[0] === rowUniqueId);

//                             return `
//                                 <tr data-row-id="${rowUniqueId}">
//                                     <td class="row-actions">
//                                         <button class="btn-delete-row" onclick="deleteSingleRow('${tableId}', '${rowUniqueId}')" title="删除此行">🗑️</button>
//                                     </td>
//                                     <td class="row-index">${rIdx + 1}</td>
//                                     ${businessData.map((cell, cIdx) => {
//                                         const realColIdx = cIdx + 1;
//                                         const oldVal = originalRow ? originalRow[realColIdx] : cell;
//                                         // 保留你的红字对比逻辑
//                                         const isChanged = cell.toString() !== (oldVal || '').toString();

//                                         return `<td class="editable-cell ${isChanged ? 'is-modified' : ''}" 
//                                                     data-table="${tableId}" 
//                                                     data-row-id="${rowUniqueId}" 
//                                                     data-col="${realColIdx}" 
//                                                     data-original="${oldVal || ''}">${cell || ''}</td>`;
//                                     }).join('')}
//                                 </tr>`;
//                         }).join('')}
//************** 临时数据
//************** 临时数据