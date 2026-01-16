/**
 * EmployeeApartmentModule - 最终稳定版
 */
window.employeeToApartmentModule = async function(containerId) {
    const CONFIG = {
        tableEmp: "employees",
        tableApt: "Apartments",
        tableRecord: "EmployeeApartment"
    };

    const [empRes, aptRes] = await Promise.all([
        getTableFullData(CONFIG.tableEmp),
        getTableFullData(CONFIG.tableApt)
    ]);
    // --- 【防御性代码：核心修复】 ---
    if (!empRes.schema || !aptRes.schema) {
        $(`#${containerId}`).html(`
            <div style="padding:40px; text-align:center; color:#721c24; background:#f8d7da; border-radius:10px; margin:20px;">
                <i class="fas fa-exclamation-triangle" style="font-size:48px;margin-bottom:20px;"></i>
                <h2>配置缺失：数据库中找不到必要的表</h2>
                <p>当前页面需要 [${CONFIG.tableEmp}] 和 [${CONFIG.tableApt}] 表。</p>
                <p>原因：IndexedDB 是本地存储，GitHub 版的环境需要重新创建表或导入备份文件。</p>
                <button onclick="location.hash='#database-management'" style="padding:10px 20px; background:#c3e6cb; border:none; cursor:pointer; border-radius:5px; margin-top:20px;">去管理界面创建表</button>
            </div>
        `);
        return; // 停止后续代码运行，防止 columns 报错
    }

    // 索引助手：确保跳过 row[0] 的 UID
    const getIdx = (schema, name) => {
        const i = schema.columns.findIndex(c => c.trim().toLowerCase() === name.toLowerCase().trim());
        return i === -1 ? -1 : i + 1; 
    };

    const iE = { 
        id: getIdx(empRes.schema, "EmployeeId"), 
        first: getIdx(empRes.schema, "First Name"), 
        sur: getIdx(empRes.schema, "Surname"), 
        nick: getIdx(empRes.schema, "Nickname"),
        city: getIdx(empRes.schema, "City"),
        accom: getIdx(empRes.schema, "Accommodation")
    };
    
    const iA = { 
        id: getIdx(aptRes.schema, "ApartmentId"), 
        addr: getIdx(aptRes.schema, "Apartment Address"), 
        city: getIdx(aptRes.schema, "City") 
    };

    const html = `
    <div class="ea-wrapper">
        <div class="ea-header">
            <h3><i class="fas fa-key"></i> 员工入住登记系统 </h3>
            <div id="ea-selection-status" style="font-size: 13px; color: #666;">请选择员工和公寓</div>
        </div>
        <div class="ea-main-content">
            <div class="ea-card">
                <div class="ea-card-head">
                    <span class="ea-label">1. 选择员工 (Employees)</span>
                    <input type="text" id="ea-emp-search" class="ea-search-input" placeholder="输入姓名、工号或城市搜索...">
                </div>
                <div class="ea-list" id="ea-emp-list"></div>
            </div>
            <div class="ea-card">
                <div class="ea-card-head">
                    <span class="ea-label">2. 选择公寓 (Apartments)</span>
                    <input type="text" id="ea-apt-search" class="ea-search-input" placeholder="输入地址或城市搜索...">
                </div>
                <div class="ea-list" id="ea-apt-list"></div>
            </div>
            <div class="ea-form-panel">
                <div class="ea-input-group">
                    <span class="ea-label">入住日期</span>
                    <input type="date" id="ea-move-in" class="ea-ui-input" value="${new Date().toISOString().split('T')[0]}">
                    <span class="ea-label" style="margin-top:15px;">每月租金 (Rent)</span>
                    <input type="text" id="ea-rent" class="ea-ui-input" placeholder="例如: 500" value="300">
                    <span class="ea-label" style="margin-top:15px;">车位编号</span>
                    <input type="text" id="ea-parking" class="ea-ui-input" placeholder="例如: P-01">
                    <span class="ea-label" style="margin-top:15px;">备注 (Note)</span>
                    <textarea id="ea-note" class="ea-ui-input" style="height:60px;"></textarea>
                    <span class="ea-label" style="margin-top:15px;">标记 (Remark)</span>
                    <textarea id="ea-remark" class="ea-ui-input" style="height:60px;"></textarea>
                </div>
                <button id="ea-save-btn" class="ea-submit-btn">办理入住</button>
            </div>
        </div>

        <div class="ea-footer-table-card">
            <div class="ea-card-head" style="display: flex; justify-content: space-between; align-items: center;">
                <span class="ea-label">3. 已入住记录查询 (Recent Records)</span>
                <input type="text" id="ea-table-search" class="ea-search-input" style="width: 300px;" placeholder="模糊搜索全表数据...">
            </div>
            <div class="ea-table-container">
                <table id="ea-record-table">
                    <thead>
                        </thead>
                    <tbody>
                        </tbody>
                </table>
            </div>
        </div>
    </div>`;

    $(`#${containerId}`).html(html);

    let state = {
        selectedEmp: null,
        selectedApt: null,
        allEmps: empRes.data.map(r => {
            const nick = (iE.nick !== -1 && r[iE.nick]) ? ` (${r[iE.nick]})` : '';
            return {
                id: String(r[iE.id] || '').trim(),
                name: `${String(r[iE.first] || '')} ${String(r[iE.sur] || '')}${nick}`.trim(),
                city: (iE.city !== -1) ? String(r[iE.city] || "").trim() : ""
            };
        }),
        allApts: aptRes.data.map(r => ({
            id: String(r[iA.id] || '').trim(),
            addr: String(r[iA.addr] || '').trim(),
            city: String(r[iA.city] || '').trim()
        }))
    };

    const renderLists = () => {
        const empK = $('#ea-emp-search').val().toLowerCase().trim();
        const aptK = $('#ea-apt-search').val().toLowerCase().trim();

        const empHtml = state.allEmps.filter(e => 
            e.name.toLowerCase().includes(empK) || e.id.toLowerCase().includes(empK) || e.city.toLowerCase().includes(empK)
        ).map(e => `
            <div class="ea-item ${state.selectedEmp?.id === e.id ? 'selected' : ''}" onclick="window.eaSelectEmp('${e.id}', '${e.name.replace(/'/g, "\\'")}')">
                <div class="ea-item-title">${e.name} <span class="ea-badge ea-bg-blue">${e.id}</span></div>
                <div class="ea-item-sub"><i class="fas fa-map-marker-alt"></i> ${e.city || '无城市信息'}</div>
            </div>`).join('');
        $('#ea-emp-list').html(empHtml);

        const aptHtml = state.allApts.filter(a => 
            a.addr.toLowerCase().includes(aptK) || a.city.toLowerCase().includes(aptK)
        ).map(a => `
            <div class="ea-item ${state.selectedApt?.id === a.id ? 'selected' : ''}" onclick="window.eaSelectApt('${a.id}', '${a.addr.replace(/'/g, "\\'")}')">
                <div class="ea-item-title">${a.addr}</div>
                <div class="ea-item-sub">${a.city} (ID: ${a.id})</div>
            </div>`).join('');
        $('#ea-apt-list').html(aptHtml);
        
        const empT = state.selectedEmp ? `<b style="color:#2980b9">${state.selectedEmp.name}</b>` : "未选员工";
        const aptT = state.selectedApt ? `<b style="color:#27ae60">${state.selectedApt.addr}</b>` : "未选公寓";
        $('#ea-selection-status').html(`${empT} <i class="fas fa-arrow-right"></i> ${aptT}`);
    };

    window.eaSelectEmp = (id, name) => { state.selectedEmp = { id, name }; renderLists(); };
    window.eaSelectApt = (id, addr) => { state.selectedApt = { id, addr }; renderLists(); };

    $('#ea-emp-search, #ea-apt-search').on('input', renderLists);

    $('#ea-save-btn').off('click').on('click', async () => {
        if (!state.selectedEmp || !state.selectedApt) return showMsg("请完整选择员工和公寓！","info");
        const rentVal = parseFloat($('#ea-rent').val()) || "";// 获取租金数值
        const moveIn = $('#ea-move-in').val();
        if (await showConfirm(`确认办理入住？\n员工: ${state.selectedEmp.name}\n公寓: ${state.selectedApt.addr}`)) {
            const targetApt = state.allApts.find(a => a.id === state.selectedApt.id);
            const newRow = [
                state.selectedEmp.id, state.selectedApt.id, state.selectedEmp.name,
                targetApt.city, state.selectedApt.addr, $('#ea-parking').val() || "",
                moveIn.split('-').reverse().join('.'), 
                "", "", "", "", "", "", "", "", "", 
                $('#ea-note').val() || "", $('#ea-remark').val() || ""
            ];

            try {
                await window.addRowToTable(CONFIG.tableRecord, newRow);

                // --- 步骤 B: 【新增】更新员工表状态 ---
                if (iE.accom !== -1) {
                    // 1. 获取员工表最新全量数据
                    const currentEmpData = await getTableFullData(CONFIG.tableEmp);
                    // 2. 找到该员工所在的行 (注意：row[iE.id] 对应的是业务 ID，row[0] 是内部 UID)
                    const rowIndex = currentEmpData.data.findIndex(row => String(row[iE.id]).trim() === String(state.selectedEmp.id).trim());
                    const iRent = getIdx(currentEmpData.schema, "Rent"); // 找到 Rent 字段在哪一列

                    if (rowIndex !== -1) {
                        // 3. 修改该行的 Accommodation 字段为 "Yes"
                        currentEmpData.data[rowIndex][iE.accom] = "Yes";
                        if (iRent !== -1) {
                            const rentInput = $('#ea-rent').val();
                            currentEmpData.data[rowIndex][iRent] = rentInput ? String(rentInput) : "0";
                        }
                        // 4. 调用 db.js 中的 updateTableAllData 写回数据库
                        await updateTableAllData(CONFIG.tableEmp, currentEmpData.data);
                        window.forceRefresh = true; //设置表数据强制刷新
                        console.log(`员工 ${state.selectedEmp.id} 住宿状态已更新为 Yes`);
                    }
                }
                showMsg("✅ 入住登记成功！员工住宿状态 已更新为Yes！","success");
                
                // --- 【核心修改：清空所有项】 ---
                state.selectedEmp = null;
                state.selectedApt = null;
                $('#ea-parking, #ea-note, #ea-remark, #ea-emp-search, #ea-apt-search').val('');
                renderLists(); 
                loadRecords();
                
            } catch (e) {
                showMsg("存储失败：" + e.message,"error");
            }
        }
    });

    // 在你的 Module 内部定义
    const loadRecords = async () => {
        const recordRes = await getTableFullData(CONFIG.tableRecord); // 获取记录表
        const keyword = $('#ea-table-search').val().toLowerCase().trim();

        // 渲染表头
        const thead = `<tr>
                <th style="width:60px; text-align:center;">操作</th> 
                ${recordRes.schema.columns.map(c => `<th>${c}</th>`).join('')}
            </tr>`;
        $('#ea-record-table thead').html(thead);

        // 渲染数据
        const tbody = recordRes.data.filter(row => {
            // 全表模糊匹配逻辑：只要这一行有任何一个单元格包含关键字就显示
            return row.some(cell => String(cell).toLowerCase().includes(keyword));
        }).map(row => {
            // row[0] 是 UID，row[1] 是第一个业务字段
            // 这里的 row 数组内容要从索引 1 开始，因为 row[0] 是 db.js 自动加的 UID
            const uid = row[0]; // 提取隐藏的唯一 UID
            const empId = row[1]; // 假设 record 表第一项业务数据是 EmployeeId
            // 构造带有垃圾桶图标的单元格
            const actionCell = `
                <td style="text-align:center;">
                    <i class="fas fa-trash-alt" 
                       style="color:#e74c3c; cursor:pointer; font-size:16px;" 
                       onclick="window.eaDeleteRecord('${uid}', '${empId}')"
                       title="删除记录并重置员工状态"></i>
                </td>`;

            const cells = row.slice(1).map(cell => `<td>${cell || ''}</td>`).join('');
            return `<tr>${actionCell}${cells}</tr>`;
        }).reverse().join(''); // reverse() 让最新的记录显示在最上面

        $('#ea-record-table tbody').html(tbody);
    };

    window.eaDeleteRecord = async (uid, empId) => {
        // if (!confirm(`确定删除该记录？\n员工 [${empId}] 的住宿状态将恢复为 No，租金归零。`)) return;
        // 使用自定义的确认框，等待用户操作
        const confirmed = await showConfirm(`确定删除该记录？\n员工 [${empId}] 的住宿状态将恢复为 No，租金归零。`);
        // 如果用户点击取消，终止操作
        if (!confirmed) return;


        try {
            // 1. 删除入住记录 (根据隐藏的 UID)
            const recordRes = await getTableFullData(CONFIG.tableRecord);
            recordRes.data = recordRes.data.filter(r => r[0] !== uid); // 过滤掉这一行
            await updateTableAllData(CONFIG.tableRecord, recordRes.data); // 覆盖回记录表

            // 2. 重置员工表信息
            const empRes = await getTableFullData(CONFIG.tableEmp);
            const iRent = getIdx(empRes.schema, "Rent");
            
            const rowIndex = empRes.data.findIndex(r => String(r[iE.id]) === String(empId));
            if (rowIndex !== -1) {
                if (iE.accom !== -1) empRes.data[rowIndex][iE.accom] = "No"; // 变回 No
                if (iRent !== -1) empRes.data[rowIndex][iRent] = ""; // 租金归零
                await updateTableAllData(CONFIG.tableEmp, empRes.data); // 覆盖回员工表

                window.forceRefresh = true; //强制刷新表格
            }

            showMsg("✅ 记录已删除，员工状态已重置。","success");
            loadRecords(); // 重新加载底部表格
        } catch (e) {
            showMsg("操作过程中出错：" + e.message,"error");
        }
    };

    // 绑定搜索事件
    $('#ea-table-search').on('input', loadRecords);

    // 在 save-btn 保存成功后，也调用一次 loadRecords()
    // 在整个模块加载末尾，执行一次 loadRecords()
    
    renderLists();
    loadRecords();
};

