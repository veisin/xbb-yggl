/**
 * ApartmentManagementModule - 2026 修复版
 */
window.apartmentManagementModule = async function(containerId) {
    // 1. 确保表名与数据库完全一致 (大小写敏感)
    const CONFIG = { tableApt: "Apartments" };

    let aptRes = await getTableFullData(CONFIG.tableApt);
    
    // 如果找不到表结构，表格头和内容都会无法渲染
    if (!aptRes || !aptRes.schema) {
        $(`#${containerId}`).html(`<div class="em-fatal-error">数据库未就绪：找不到 [${CONFIG.tableApt}] 表</div>`);
        return;
    }

    // 助手函数：获取字段在数组中的索引 (+1 是因为 row[0] 是 UID)
    const getIdx = (schema, name) => {
        const i = schema.columns.findIndex(c => c.trim().toLowerCase() === name.toLowerCase().trim());
        return i === -1 ? -1 : i + 1; 
    };

    const iA = {
        id: getIdx(aptRes.schema, "ApartmentId"),
        status: getIdx(aptRes.schema, "Status")
    };

    let state = {
        allColumns: aptRes.schema.columns,
        visibleColumns: [...aptRes.schema.columns],
        currentData: aptRes.data || [],
        currentEditUid: null
    };

    // 2. 自动生成编号逻辑 (APT130 -> APT140)
    const generateNextId = () => {
        if (iA.id === -1) return "APT130";
        let maxNum = 0;
        let prefix = "APT";
        state.currentData.forEach(r => {
            const match = String(r[iA.id]).match(/([A-Z]+)(\d+)/i);
            if (match) {
                prefix = match[1];
                const num = parseInt(match[2]);
                if (num > maxNum) maxNum = num;
            }
        });
        return prefix + (maxNum === 0 ? 130 : maxNum + 10);
    };

    const html = `
        <div class="em-app-container apt-module">
            <div class="em-app-container">
                <div class="em-fixed-header">
                    <div class="em-header-main">
                        <div class="em-brand">
                            <i class="fas fa-building"></i>
                            <div class="em-title-info">
                                <h2>公寓档案管理</h2>
                                <div class="em-stats-chips">
                                    <span class="chip-total">总公寓: <b id="apt-total">0</b></span>
                                    ${"" /* 这里是隐藏的代码：<span class="chip-accom">已出租: <b id="apt-rented">0</b></span> */}
                                </div>
                            </div>
                        </div>
                        <div class="em-toolbar">
                            <div class="em-search-wrapper">
                                <i class="fas fa-search"></i>
                                <input type="text" id="apt-global-filter" placeholder="搜索公寓...">
                            </div>
                            <button class="em-btn primary" onclick="window.aptOpenAdd()">
                                <i class="fas fa-plus"></i> 新增公寓
                            </button>
                        </div>
                    </div>
                </div>

                <div class="em-content-area">
                    <div class="em-table-viewport">
                        <table id="em-master-table">
                            <thead><tr id="apt-th-wrapper"></tr></thead>
                            <tbody id="apt-tb-wrapper"></tbody>
                        </table>
                    </div>
                </div>

                <div class="em-mask" id="apt-drawer-mask"></div>
                <div class="em-drawer" id="apt-drawer-panel">
                    <div class="em-drawer-header">
                        <h3 id="apt-edit-title">编辑公寓</h3>
                        <button class="em-close-x" onclick="window.aptCloseDrawer()">&times;</button>
                    </div>
                    <div class="em-drawer-body">
                        <form id="apt-dynamic-form"></form>
                    </div>
                    <div class="em-drawer-footer">
                        <button class="em-btn secondary" onclick="window.aptCloseDrawer()">取消</button>
                        <button class="em-btn primary" id="apt-final-save">保存</button>
                    </div>
                </div>
            </div>
        </div>      
    `;

    $(`#${containerId}`).html(html);

    // 渲染表格
    const renderTable = () => {
        const kw = $('#apt-global-filter').val().toLowerCase().trim();
        const filtered = state.currentData.filter(r => r.some(c => String(c).toLowerCase().includes(kw)));

        // 更新统计 (修复显示为0的问题)
        $('#apt-total').text(state.currentData.length);
        $('#apt-rented').text(state.currentData.filter(r => String(r[iA.status]).toLowerCase().includes("rented")).length);

        // 渲染表头 (修复消失的问题)
        let ths = "";
        state.allColumns.forEach(col => {
            if (state.visibleColumns.includes(col)) {
                ths += `<th>${col}</th>`;
            }
        });
        ths += `<th class="em-sticky-opt-col">操作</th>`;
        $('#apt-th-wrapper').html(ths);

        const today = new Date(); today.setHours(0,0,0,0);
        const rowsHtml = filtered.map(row => {
            let tds = "";
            state.allColumns.forEach((col, idx) => {
                if (state.visibleColumns.includes(col)) {
                    let val = row[idx+1] || "";
                    let cellClass = "";

                    // 到期变色逻辑
                    if (col.toLowerCase().includes("end date") && val) {
                        const p = String(val).split('.');
                        const endD = new Date(p[2], p[1]-1, p[0]);
                        if (!isNaN(endD)) {
                            const diff = Math.ceil((endD - today) / 86400000);
                            if (diff < 0) cellClass = "cell-expired";
                            else if (diff <= 3) cellClass = "cell-3days";
                            else if (diff <= 10) cellClass = "cell-10days";
                            else if (diff <= 20) cellClass = "cell-20days";
                            else if (diff <= 30) cellClass = "cell-30days";
                        }
                    }
                    tds += `<td class="${cellClass}">${val}</td>`;
                }
            });

            // 操作按钮参考 db.js 的 UID 逻辑
            tds += `<td class="em-sticky-opt-col">
                <button onclick="window.aptEditRow('${row[0]}')" class="btn-edit"><i class="fas fa-edit"></i></button>
                <button onclick="window.aptDeleteRow('${row[0]}', '${row[iA.id]}')" class="btn-del"><i class="fas fa-trash-alt"></i></button>
            </td>`;
            return `<tr>${tds}</tr>`;
        }).join('');

        $('#apt-tb-wrapper').html(rowsHtml || `<tr><td colspan="50" class="empty-td">无匹配数据</td></tr>`);
    };

    // 渲染表单
    const renderForm = (rowData = null) => {
        const fields = state.allColumns.map((col, idx) => {
            let val = rowData ? rowData[idx+1] : "";
            const isId = (idx+1 === iA.id);
            const colLower = col.toLowerCase().trim();
            const isDate = (colLower.includes("date") || colLower.includes("日期")) && !colLower.includes("payment");

            let inputHtml = "";
            if (colLower.includes("payment date")) {
                // Payment Date 强制文本框
                inputHtml = `<input type="text" id="apt-inp-${idx}" value="${val}" placeholder="例如: 每月15号">`;
            } else if (isDate) {
                // 转换日期格式供 input type="date" 使用
                let dVal = "";
                if (val && val.includes('.')) {
                    const p = val.split('.');
                    dVal = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
                }
                inputHtml = `<input type="date" id="apt-inp-${idx}" value="${dVal}">`;
            } else {
                inputHtml = `<input type="text" id="apt-inp-${idx}" value="${val}" ${isId && rowData ? 'disabled' : ''}>`;
            }

            return `<div class="em-form-item"><label>${col}</label>${inputHtml}</div>`;
        }).join('');
        $('#apt-dynamic-form').html(fields);
    };

    // --- 全局动作 ---
    window.aptOpenAdd = () => {
        state.currentEditUid = null;
        renderForm();
        if (iA.id !== -1) $(`#apt-inp-${iA.id-1}`).val(generateNextId());
        $('#apt-edit-title').text("新增公寓");
        window.aptToggleDrawer(true);
    };

    window.aptEditRow = (uid) => {
        state.currentEditUid = uid;
        const row = state.currentData.find(r => r[0] === uid);
        renderForm(row);
        $('#apt-edit-title').text("修改公寓信息");
        window.aptToggleDrawer(true);
    };

    // 删除逻辑参考 db.js
    window.aptDeleteRow = async (uid, displayId) => {
        if (await showConfirm(`确定删除公寓 ${displayId} 吗？`)) {
            await deleteRowByUid(CONFIG.tableApt, uid);
            refresh();
        }
    };

    window.aptToggleDrawer = (s) => {
        if(s) { $('#apt-drawer-panel, #apt-drawer-mask').addClass('active'); }
        else { $('#apt-drawer-panel, #apt-drawer-mask').removeClass('active'); }
    };
    window.aptCloseDrawer = () => window.aptToggleDrawer(false);

    // 保存逻辑参考 db.js
    $('#apt-final-save').off('click').on('click', async () => {
        const newId = $(`#apt-inp-${iA.id-1}`).val().trim();
        
        // 新增查重
        if (!state.currentEditUid) {
            const exists = state.currentData.some(r => String(r[iA.id]).trim() === newId);
            if (exists) return showMsg(`错误：公寓编号 ${newId} 已存在！`,"error");
        }

        const payload = state.allColumns.map((col, i) => {
            let v = $(`#apt-inp-${i}`).val() || "";
            if ($(`#apt-inp-${i}`).attr('type') === 'date' && v.includes('-')) {
                const p = v.split('-');
                return `${p[2]}.${p[1]}.${p[0]}`;
            }
            return v;
        });

        try {
            if (state.currentEditUid) {
                // 修改：全量覆盖数据
                const updated = state.currentData.map(r => 
                    r[0] === state.currentEditUid ? [r[0], ...payload] : r
                );
                await updateTableAllData(CONFIG.tableApt, updated);
            } else {
                // 新增：追加行
                await addRowToTable(CONFIG.tableApt, payload);
            }
            window.aptCloseDrawer();
            refresh();
        } catch (e) { alert("操作失败"); }
    });

    const refresh = async () => {
        const res = await getTableFullData(CONFIG.tableApt);
        state.currentData = res.data || [];
        renderTable();
    };

    $('#apt-global-filter').on('input', renderTable);
    refresh();
};