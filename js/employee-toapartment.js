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
        city: getIdx(empRes.schema, "City") 
    };
    
    const iA = { 
        id: getIdx(aptRes.schema, "ApartmentId"), 
        addr: getIdx(aptRes.schema, "Apartment Address"), 
        city: getIdx(aptRes.schema, "City") 
    };

    const html = `
    <div class="ea-wrapper">
        <div class="ea-header">
            <h3><i class="fas fa-key"></i> 员工入住登记系统</h3>
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
                    <span class="ea-label" style="margin-top:15px;">车位编号</span>
                    <input type="text" id="ea-parking" class="ea-ui-input" placeholder="例如: P-01">
                    <span class="ea-label" style="margin-top:15px;">备注 (Note)</span>
                    <textarea id="ea-note" class="ea-ui-input" style="height:60px;"></textarea>
                    <span class="ea-label" style="margin-top:15px;">标记 (Remark)</span>
                    <textarea id="ea-remark" class="ea-ui-input" style="height:50px;"></textarea>
                </div>
                <button id="ea-save-btn" class="ea-submit-btn">办理入住</button>
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
        if (!state.selectedEmp || !state.selectedApt) return alert("请完整选择员工和公寓！");
        
        const moveIn = $('#ea-move-in').val();
        if (confirm(`确认办理入住？\n员工: ${state.selectedEmp.name}\n公寓: ${state.selectedApt.addr}`)) {
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
                alert("✅ 入住登记成功！");
                
                // --- 【核心修改：清空所有项】 ---
                state.selectedEmp = null;
                state.selectedApt = null;
                $('#ea-parking, #ea-note, #ea-remark, #ea-emp-search, #ea-apt-search').val('');
                renderLists(); 
            } catch (e) {
                alert("存储失败：" + e.message);
            }
        }
    });

    renderLists();
};