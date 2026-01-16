/**
 * EmployeeManagementModule - 旗舰增强版 (2026 稳定版)
 */
window.employeeManagementModule = async function(containerId) {
    const CONFIG = { tableEmp: "employees" };

    // 1. 初始化数据
    let empRes = await getTableFullData(CONFIG.tableEmp);
    if (!empRes.schema) {
        $(`#${containerId}`).html(`<div class="em-fatal-error">数据库未就绪：找不到 [employees] 表</div>`);
        return;
    }

    const getIdx = (schema, name) => {
        const i = schema.columns.findIndex(c => c.trim().toLowerCase() === name.toLowerCase().trim());
        return i === -1 ? -1 : i + 1; 
    };

    const iE = {
        id: getIdx(empRes.schema, "EmployeeId"),
        accom: getIdx(empRes.schema, "Accommodation"),
        rent: getIdx(empRes.schema, "Rent")
    };

    // 状态管理
    let state = {
        allColumns: empRes.schema.columns,
        visibleColumns: [...empRes.schema.columns],
        originalData: [], // 备份一份原始数据用于“还原”排序
        currentData: empRes.data,
        currentEditUid: null,
        sortConfig: { key: 0, direction: 'none' } // 默认正序
    };

    // 智能工号自增 logic
    const generateNextId = () => {
        if (iE.id === -1) return "EMP00005";
        let maxNum = 0;
        let prefix = "EMP";
        state.currentData.forEach(r => {
            const match = String(r[iE.id]).match(/([A-Z]+)(\d+)/i);
            if (match) {
                prefix = match[1];
                const num = parseInt(match[2]);
                if (num > maxNum) maxNum = num;
            }
        });
        return prefix + String(maxNum + 5).padStart(5, '0');
    };

    // 排序逻辑
    const sortData = (colIdx) => {
        if (state.sortConfig.key !== colIdx) {
            state.sortConfig.key = colIdx;
            state.sortConfig.direction = 'asc';
        } else {
            if (state.sortConfig.direction === 'asc') state.sortConfig.direction = 'desc';
            else if (state.sortConfig.direction === 'desc') state.sortConfig.direction = 'none';
            else state.sortConfig.direction = 'asc';
        }

        if (state.sortConfig.direction === 'none') {
            // 还原：按工号正序
            state.currentData = [...state.originalData].sort((a, b) => 
                String(a[iE.id]).localeCompare(String(b[iE.id]), undefined, {numeric: true}));
        } else {
            state.currentData.sort((a, b) => {
                let vA = a[colIdx], vB = b[colIdx];
                if (!isNaN(parseFloat(vA)) && !isNaN(parseFloat(vB))) {
                    return state.sortConfig.direction === 'asc' ? vA - vB : vB - vA;
                }
                vA = String(vA); vB = String(vB);
                return state.sortConfig.direction === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
            });
        }
        renderTable();
    };

    const html = `
    <div class="em-app-container">
        <div class="em-fixed-header">
            <div class="em-header-main">
                <div class="em-brand">
                    <i class="fas fa-address-book"></i>
                    <div class="em-title-info">
                        <h2>员工档案管理</h2>
                        <div class="em-stats-chips">
                            <span class="chip-total">总计: <b id="st-total">0</b></span>
                            <span class="chip-accom">住宿: <b id="st-accom">0</b></span>
                        </div>
                    </div>
                </div>
                <div class="em-toolbar">
                    <div class="em-search-wrapper">
                        <i class="fas fa-search"></i>
                        <input type="text" id="em-global-filter" placeholder="全表搜索...">
                    </div>
                    <div class="em-dropdown-area">
                        <button class="em-btn secondary" id="em-col-toggle-btn">
                            <i class="fas fa-columns"></i> 显示列
                        </button>
                        <div class="em-col-popup" id="em-col-popup">
                            <div class="pop-header">
                                <label><input type="checkbox" id="em-all-master" checked> <b>全选</b></label>
                            </div>
                            <div id="em-col-list-inner" class="pop-list"></div>
                        </div>
                    </div>
                    <button class="em-btn primary" onclick="window.emOpenAdd()">
                        <i class="fas fa-plus"></i> 新增员工
                    </button>
                </div>
            </div>
        </div>

        <div class="em-content-area">
            <div class="em-table-viewport">
                <table id="em-master-table">
                    <thead><tr id="em-th-wrapper"></tr></thead>
                    <tbody id="em-tb-wrapper"></tbody>
                </table>
            </div>
        </div>

        <div class="em-mask" id="em-drawer-mask" onclick="window.emCloseDrawer()"></div>
        <div class="em-drawer" id="em-drawer-panel">
            <div class="em-drawer-header">
                <h3 id="em-edit-title">编辑档案</h3>
                <button class="em-close-x" onclick="window.emCloseDrawer()">&times;</button>
            </div>
            <div class="em-drawer-body">
                <form id="em-dynamic-form"></form>
            </div>
            <div class="em-drawer-footer">
                <button class="em-btn secondary" onclick="window.emCloseDrawer()">取消</button>
                <button class="em-btn primary" id="em-final-save">保存</button>
            </div>
        </div>
    </div>`;

    $(`#${containerId}`).html(html);

    // 渲染表格
    const renderTable = () => {
        const kw = $('#em-global-filter').val().toLowerCase().trim();
        const filtered = state.currentData.filter(r => r.some(c => String(c).toLowerCase().includes(kw)));

        $('#st-total').text(state.currentData.length);
        $('#st-accom').text(state.currentData.filter(r => r[iE.accom] === "Yes").length);

        // --- 核心变量：判断当前有没有勾选任何列 ---
        const hasVisibleCols = state.visibleColumns.length > 0;

        // 渲染表头并添加排序点击
        let ths = "";
        state.allColumns.forEach((col, idx) => {
            if (state.visibleColumns.includes(col)) {
                const isCur = state.sortConfig.key === (idx + 1);
                let icon = '<i class="fas fa-sort" style="opacity:0.3"></i>';
                if (isCur && state.sortConfig.direction === 'asc') icon = '<i class="fas fa-sort-up"></i>';
                if (isCur && state.sortConfig.direction === 'desc') icon = '<i class="fas fa-sort-down"></i>';
                ths += `<th onclick="window.emSortColumn(${idx + 1})">${col} ${icon}</th>`;
            }
        });

        // 修改点 1: 只有当有列显示时，才显示“操作”表头
        if (hasVisibleCols) {
            ths += `<th class="em-sticky-opt-col">操作</th>`;
        } else {
            ths = `<th style="text-align:left;padding-left: 20px; color: #94a3b8; color:#999;position: sticky; left: 0;">请在右上角【显示列】勾选需要查看的数据字段</th>`;
        }
        
        $('#em-th-wrapper').html(ths);

        // const rowsHtml = filtered.map(row => {

        //     let tds = "";
        //     state.allColumns.forEach((col, idx) => {
        //         if (state.visibleColumns.includes(col)) {
        //             let val = row[idx+1] || "";
        //             if (idx+1 === iE.accom) {
        //                 tds += `<td><span class="em-badge ${val === 'Yes' ? 'yes' : 'no'}">${val || 'No'}</span></td>`;
        //             } else {
        //                 tds += `<td class="${cellClass}">${val}</td>`;
        //             }
        //         }
        //     });

        //     // 修改点 2: 只有当有列显示时，才拼接操作列按钮
        //     if (hasVisibleCols) {
        //         tds += `<td class="em-sticky-opt-col">
        //             <button onclick="window.emEditRow('${row[0]}')" class="btn-edit"><i class="fas fa-edit"></i></button>
        //             <button onclick="window.emDeleteRow('${row[0]}', '${row[iE.id]}')" class="btn-del"><i class="fas fa-trash-alt"></i></button>
        //         </td>`;
        //     } else {
        //         // 没有列时，每行只占一个空位，不显示按钮
        //         tds = `<td style="text-align:center; color:#eee;">-</td>`;
        //     }

        //     return `<tr>${tds}</tr>`;
        // }).join('');
        const rowsHtml = filtered.map(row => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let tds = "";
            state.allColumns.forEach((col, idx) => {
                if (state.visibleColumns.includes(col)) {
                    let val = row[idx+1] || "";
                    let cellClass = ""; 

                    const isEndDateCol = col && col.toLowerCase().trim().includes("end date");
                    if (isEndDateCol) {
                        if (val) {
                            try {
                                // 统一转换格式 DD.MM.YYYY 或 YYYY-MM-DD 为可识别日期
                                let cleanVal = String(val).replace(/\./g, '-'); 
                                let parts = cleanVal.split('-');
                                let endD;
                                
                                if (parts[0].length === 4) { // YYYY-MM-DD
                                    endD = new Date(parts[0], parts[1]-1, parts[2]);
                                } else { // DD-MM-YYYY
                                    endD = new Date(parts[2], parts[1]-1, parts[0]);
                                }

                                if (!isNaN(endD.getTime())) {
                                    const diffDays = Math.ceil((endD - today) / (1000 * 60 * 60 * 24));
                                    
                                    if (diffDays < 0) cellClass = "cell-expired";
                                    else if (diffDays <= 3) cellClass = "cell-3days";
                                    else if (diffDays <= 10) cellClass = "cell-10days";
                                    else if (diffDays <= 20) cellClass = "cell-20days";
                                    else if (diffDays <= 30) cellClass = "cell-30days";
                                }
                            } catch (e) { console.error("日期解析失败", e); }
                        }
                    }
                    // --- 调试结束 ---

                    if (idx+1 === iE.accom) {
                        tds += `<td><span class="em-badge ${val === 'Yes' ? 'yes' : 'no'}">${val || 'No'}</span></td>`;
                    } else {
                        // 这里是关键：确认 cellClass 是否被拼接到 HTML 中
                        tds += `<td class="${cellClass}">${val}</td>`;
                    }
                }
            });

            if (hasVisibleCols) {
                tds += `<td class="em-sticky-opt-col">
                    <button onclick="window.emEditRow('${row[0]}')" class="btn-edit"><i class="fas fa-edit"></i></button>
                    <button onclick="window.emDeleteRow('${row[0]}', '${row[iE.id]}')" class="btn-del"><i class="fas fa-trash-alt"></i></button>
                </td>`;
            } else {
                tds = `<td style="text-align:left; padding-left: 20px; color:#eee; position: sticky; left: 0;">-</td>`;
            }

            return `<tr>${tds}</tr>`;
        }).join('');

        $('#em-tb-wrapper').html(rowsHtml || `<tr><td colspan="50" class="empty-td">无匹配数据</td></tr>`);
    };

    // 渲染表单
    const renderForm = (rowData = null) => {
        const fields = state.allColumns.map((col, idx) => {
            let val = rowData ? rowData[idx+1] : "";
            const isId = (idx+1 === iE.id);
            const isSystem = (idx+1 === iE.accom || idx+1 === iE.rent);
            const isNote = col.toLowerCase().includes("note") || col.toLowerCase().includes("remark");
            const isDate = col.toLowerCase().includes("date") || col.toLowerCase().includes("日期");

            if (isDate && val) {
                // --- 高容错日期解析逻辑 ---
                // 1. 统一分隔符，把 . 替换成 -
                let cleanVal = String(val).replace(/\./g, '-').trim();
                
                if (cleanVal.includes('-')) {
                    const parts = cleanVal.split('-');
                    if (parts.length === 3) {
                        // 判断是 [日,月,年] 还是 [年,月,日]
                        // 如果第一部分长度是4位，说明是 YYYY-MM-DD，直接用
                        if (parts[0].length === 4) {
                            val = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
                        } else {
                            // 否则认为是 DD-MM-YYYY，反转它
                            val = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                        }
                    }
                }
                // 如果 val 最终不符合 YYYY-MM-DD 格式，input date 会自动显示为空，不会报错
            }

            let inputHtml = "";
            if (isNote) {
                inputHtml = `<textarea id="inp-${idx}" placeholder="请输入${col}...">${val}</textarea>`;
            } else if (isDate) {
                inputHtml = `<input type="date" id="inp-${idx}" value="${val}">`;
            } else {
                inputHtml = `<input type="text" id="inp-${idx}" value="${val}" ${isId && rowData ? 'disabled' : ''}>`;
            }

            return `
                <div class="em-form-item">
                    <label>${col} ${isSystem ? '<span class="lock-tip" title="建议在员工入住模块修改">(宿)</span>' : ''}</label>
                    ${inputHtml}
                </div>`;
        }).join('');
        $('#em-dynamic-form').html(fields);
        
        // 绑定修改提示
        // if(iE.accom !== -1) {
        //     $(`#inp-${iE.accom-1}, #inp-${iE.rent-1}`).on('focus', function() {
        //         showMsg("提示：修改住宿和租金建议在【员工入住设置】中操作，以确保数据同步。", "warning");
        //     });
        // }

        // 在 renderForm 生成 HTML 之后执行
        $('#em-dynamic-form').find('input').each(function(i) {
            const colName = state.allColumns[i];
            if (colName === 'Rent' || colName === 'Accommodation') {
                $(this).on('focus', function() {
                    // 如果你有消息插件就用消息插件，没有就用 alert
                    if(window.showMsg) {
                        showMsg(`警告：正在修改 ${colName}。建议在“员工入住设置”模块操作，以同步财务数据。`, "warning");
                    } else {
                        console.warn("修改敏感字段提示");
                    }
                });
                // 变色提醒
                $(this).css('border-left', '4px solid red');
            }
        });
    };

    // 全局函数映射
    window.emSortColumn = (idx) => sortData(idx);
    window.emOpenAdd = () => {
        state.currentEditUid = null;
        renderForm();
        if (iE.id !== -1) $(`#inp-${iE.id-1}`).val(generateNextId());
        $('#em-edit-title').text("新增员工记录");
        window.emToggleDrawer(true);
    };
    window.emEditRow = (uid) => {
        state.currentEditUid = uid;
        const row = state.currentData.find(r => r[0] === uid);
        renderForm(row);
        $('#em-edit-title').text("修改员工档案");
        window.emToggleDrawer(true);
    };
    window.emDeleteRow = async (uid, id) => {
        if (await showConfirm(`确定删除员工 ${id} 吗？`)) {
            await deleteRowByUid(CONFIG.tableEmp, uid);
            refresh();
        }
    };
    window.emToggleDrawer = (s) => {
        if(s) { $('#em-drawer-panel, #em-mask').addClass('active'); }
        else { $('#em-drawer-panel, #em-mask').removeClass('active'); }
    };
    window.emCloseDrawer = () => window.emToggleDrawer(false);

    // const refresh = async () => {
    //     const res = await getTableFullData(CONFIG.tableEmp);
    //     state.currentData = res.data;
    //     // 默认按工号正序
    //     state.currentData.sort((a,b) => String(a[iE.id]).localeCompare(String(b[iE.id]), undefined, {numeric: true}));
    //     renderTable();
    // };
    const refresh = async () => {
        const res = await getTableFullData(CONFIG.tableEmp);
        state.originalData = res.data; 
        state.currentData = [...res.data];
        // 初始还原排序
        state.sortConfig.direction = 'none';
        window.emSortColumn(null); 
    };

    // 事件监听
    $('#em-global-filter').on('input', renderTable);
    $('#em-col-toggle-btn').on('click', (e) => { e.stopPropagation(); $('#em-col-popup').toggle(); });
    $(document).on('click', () => $('#em-col-popup').hide());
    $('#em-col-popup').on('click', e => e.stopPropagation());

    // 【关键】列配置事件监听
    $(document).off('change', '#em-all-master').on('change', '#em-all-master', function() {
        const isChecked = $(this).is(':checked');
        $('.col-sw').prop('checked', isChecked);
        state.visibleColumns = isChecked ? [...state.allColumns] : [];
        renderTable();
    });

    $(document).off('change', '.col-sw').on('change', '.col-sw', function() {
        const val = $(this).val();
        if($(this).is(':checked')) {
            if(!state.visibleColumns.includes(val)) state.visibleColumns.push(val);
        } else {
            state.visibleColumns = state.visibleColumns.filter(x => x !== val);
        }
        // 更新全选框状态
        $('#em-all-master').prop('checked', state.visibleColumns.length === state.allColumns.length);
        renderTable();
    });

    const colListHtml = state.allColumns.map(c => `
        <label><input type="checkbox" class="col-sw" value="${c}" checked> ${c}</label>
    `).join('');
    $('#em-col-list-inner').html(colListHtml);

    // $(document).on('change', '.col-sw', function() {
    //     const val = $(this).val();
    //     if($(this).is(':checked')) state.visibleColumns.push(val);
    //     else state.visibleColumns = state.visibleColumns.filter(x => x !== val);
    //     renderTable();
    // });

    $('#em-final-save').off('click').on('click', async () => {
        // 1. 处理数据，如果是日期则转换格式
        const payload = state.allColumns.map((col, i) => {
            let val = $(`#inp-${i}`).val() || "";
            const isDate = col.toLowerCase().includes("date") || col.toLowerCase().includes("日期");

            // 如果是日期控件，将 YYYY-MM-DD 转为 DD.MM.YYYY
            if (isDate && val && val.includes('-')) {
                const parts = val.split('-');
                if (parts.length === 3) {
                    // 这里的转换结果就是：15.01.2024
                    val = `${parts[2]}.${parts[1]}.${parts[0]}`;
                }
            }
            return val;
        });

        try {
            if (state.currentEditUid) {
                // 修改逻辑：将 UID 放在首位，后面跟着 payload
                const updated = state.currentData.map(r => 
                    r[0] === state.currentEditUid ? [r[0], ...payload] : r
                );
                await updateTableAllData(CONFIG.tableEmp, updated);
            } else {
                // 新增逻辑
                await addRowToTable(CONFIG.tableEmp, payload);
            }
            window.emCloseDrawer();
            refresh();
            if(window.showMsg) showMsg("保存成功");
        } catch (e) { 
            alert("保存失败: " + e.message); 
        }
    });

    refresh();
};