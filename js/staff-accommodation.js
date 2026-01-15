/**
 * 住宿费计算与交叉核对模块 (V6.0)
 * 1. 处理所有表的 UID 偏移
 * 2. 强化 EmployeeNo 姓名匹配
 * 3. 底部明细化诊断看板
 */

window.staffAccommodationModule = async function(containerId) {
    const allTables = await getAllTableConfigs();
    const tableOptions = allTables.map(t => `<option value="${t.id}">${t.title || t.id}</option>`).join('');

    const html = `
        <div class="accommodation-outer-wrapper">
            <style>
                .accommodation-outer-wrapper { display: flex; width: 100%; height: 100%; background: #f0f2f5; gap: 15px; padding: 15px; box-sizing: border-box; flex-direction: column; overflow: hidden; }
                .top-content-area { display: flex; flex: 1; gap: 15px; min-height: 0; }
                
                /* 左侧设置区 */
                .accom-settings-side { width: 300px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow-y: auto; }
                .side-card h4 { margin: 0 0 12px 0; color: #333; font-size: 15px; border-left: 4px solid #3498db; padding-left: 10px; }
                
                /* 右侧结果区 */
                .accom-result-main { flex: 1; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; flex-direction: column; overflow: hidden; }
                
                /* 底部诊断区 - 强化版 */
                .exception-diagnostic-center { height: 240px; background: #fff; border-radius: 8px; border-top: 4px solid #ff4d4f; padding: 15px; box-shadow: 0 -2px 10px rgba(0,0,0,0.05); overflow-y: auto; }
                .diag-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
                .diag-card { padding: 10px; border-radius: 6px; border: 1px solid #eee; background: #fafafa; }
                .diag-card h5 { margin: 0 0 8px 0; font-size: 13px; display: flex; align-items: center; gap: 5px; }
                .diag-item { font-size: 11px; padding: 4px 8px; margin-bottom: 4px; border-radius: 4px; background: #fff; border: 1px solid #f0f0f0; line-height: 1.4; }
                .diag-tag { font-weight: bold; color: #cf1322; }

                .ui-label { display: block; font-size: 11px; color: #777; margin-bottom: 3px; font-weight: bold; }
                .accom-ui-select, .accom-ui-input, .accom-ui-area { width: 100%; padding: 7px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box; }
                
                .table-container { flex: 1; overflow: auto; border: 1px solid #eee; border-radius: 4px; }
                .audit-table { width: 100%; border-collapse: collapse; font-size: 12px; }
                .audit-table th { background: #f8f9fa; padding: 10px; border-bottom: 2px solid #eee; position: sticky; top: 0; z-index: 10; text-align: left; }
                .audit-table td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
                
                .row-warning { background-color: #fffaf0 !important; } /* 缺日期 */
                .row-danger { background-color: #fff1f0 !important; }  /* 库缺失 */
                .row-special { background-color: #f9f0ff !important; } /* 库外人员 */
                .row-override { background-color: #e6fffb !important; }
                
                .btn-run { width: 100%; padding: 12px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
            </style>

            <div class="top-content-area">
                <div class="accom-settings-side">
                    <div class="side-card">
                        <h4>数据源选择</h4>
                        <label class="ui-label">员工表 (Employees)</label>
                        <select id="tableEmp" class="accom-ui-select">${tableOptions}</select>
                        <label class="ui-label">住宿表 (Apartment)</label>
                        <select id="tableApt" class="accom-ui-select">${tableOptions}</select>
                        <label class="ui-label">员工编号表 (EmployeeNo)</label>
                        <select id="tableNo" class="accom-ui-select">${tableOptions}</select>
                        
                        <label class="ui-label">结算月份</label>
                        <input type="month" id="calcMonth" class="accom-ui-input" value="${new Date().toISOString().slice(0, 7)}">
                    </div>
                    
                    <div class="side-card" style="margin-top:15px;">
                        <h4>特殊规则</h4>
                        <label class="ui-label">覆盖 ID (每行一个)</label>
                        <textarea id="overrideIds" class="accom-ui-area" placeholder="EMP0010"></textarea>
                        <label class="ui-label">统一覆盖金额</label>
                        <input type="number" id="overrideAmount" class="accom-ui-input" value="0">
                        <button class="btn-run" onclick="window.runAccommodationAudit()">计算并诊断</button>
                    </div>
                </div>

                <div class="accom-result-main">
                    <div class="table-container">
                        <table class="audit-table">
                            <thead>
                                <tr>
                                    <th>状态</th>
                                    <th>工号</th>
                                    <th>姓名 (First + Surname)</th>
                                    <th>入住日期</th>
                                    <th>原标准</th>
                                    <th>当月预估</th>
                                    <th>次月标准</th>
                                </tr>
                            </thead>
                            <tbody id="accomAuditBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="exception-diagnostic-center" id="diagCenter">
                <h4 style="margin:0 0 12px 0; color:#333; font-size:14px;"><i class="fas fa-microscope"></i> 结算异常明细诊断表</h4>
                <div class="diag-grid" id="diagGrid">
                    </div>
            </div>
        </div>
    `;

    $(`#${containerId}`).empty().html(html).show();
};

window.runAccommodationAudit = async function() {
    const baseMonthStr = $('#calcMonth').val();
    const baseDate = new Date(baseMonthStr + "-01");
    const overrideIds = $('#overrideIds').val().toUpperCase().split('\n').map(s => s.trim()).filter(s => s);
    const overrideVal = parseFloat($('#overrideAmount').val()) || 0;

    try {
        const [empRes, aptRes, noRes] = await Promise.all([
            getTableFullData($('#tableEmp').val()),
            getTableFullData($('#tableApt').val()),
            getTableFullData($('#tableNo').val())
        ]);
        
        // 使用你验证过的正确偏移逻辑
        const getIdx = (schema, name) => schema.columns.findIndex(c => c.toLowerCase().includes(name.toLowerCase())) + 1;
        
        // 索引映射
        const idxE = { id: getIdx(empRes.schema, "employeeid"), surname: getIdx(empRes.schema, "surname"), first: getIdx(empRes.schema, "first name"), accom: getIdx(empRes.schema, "accommodation"), rent: getIdx(empRes.schema, "rent") };
        const idxA = { id: getIdx(aptRes.schema, "employeeid"), date: getIdx(aptRes.schema, "move-in date") };
        const idxN = { id: getIdx(noRes.schema, "employeeid"), surname: getIdx(noRes.schema, "surname"), first: getIdx(noRes.schema, "firstname") }; // 注意这里配合你的JSON是firstname

        // 1. 构建最全的姓名索引 (EmployeeNo)
        const nameMaster = new Map();
        noRes.data.forEach(row => {
            const id = String(row[idxN.id] || '').trim().toUpperCase();
            if(id && id !== "UNDEFINED") {
                // 根据你提供的JSON结构：FirstName在后，Surname在前，中间可能有空
                const fName = String(row[idxN.first] || '').trim();
                const sName = String(row[idxN.surname] || '').trim();
                nameMaster.set(id, `${fName} ${sName}`.trim());
            }
        });

        // 2. 扫描员工表
        const empMap = new Map();
        empRes.data.forEach(row => {
            if(String(row[idxE.accom]).trim().toUpperCase() === 'YES') {
                const id = String(row[idxE.id]).trim().toUpperCase();
                // 姓名补全逻辑：优先看主表，主表没名字去编号表找
                let name = `${row[idxE.first] || ''} ${row[idxE.surname] || ''}`.trim();
                if ((!name || name.length < 2) && nameMaster.has(id)) name = nameMaster.get(id);
                
                empMap.set(id, { id, name: name || "Unknown", rentStr: String(row[idxE.rent] || ""), processed: false });
            }
        });

        // 3. 扫描住宿表
        const aptMap = new Map();
        aptRes.data.forEach(row => {
            const id = String(row[idxA.id]).trim().toUpperCase();
            if(id && id !== "XXXXX" && id !== "UNDEFINED") {
                aptMap.set(id, { id, moveIn: row[idxA.date], processed: false });
            }
        });

        const finalResults = [];

        // 4. 交叉比对
        empMap.forEach((emp, id) => {
            const apt = aptMap.get(id);
            let status = "NORMAL";
            let moveIn = apt ? apt.moveIn : null;

            if (overrideIds.includes(id)) status = "OVERRIDE";
            else if (!apt) status = "MISSING_IN_APT";
            // 严谨判定日期缺失：必须同时检查 null 和 "undefined" 字符串
            else if (!moveIn || String(moveIn).trim() === "undefined" || String(moveIn).trim() === "null") status = "NO_DATE";
            
            const calc = calculateRent(emp.rentStr, status === "NO_DATE" ? null : moveIn, baseDate, status === "OVERRIDE" ? overrideVal : null);
            finalResults.push({ ...emp, moveIn: (status === "NO_DATE" ? null : moveIn), ...calc, status });
            if(apt) apt.processed = true;
        });

        // 5. 处理库外居住人员 (针对 EMP0180/EMP0365 的姓名修复)
        aptMap.forEach((apt, id) => {
            if(!apt.processed) {
                // 关键修复：从全员库找名字，不再显示“未知”
                const name = nameMaster.get(id) || "库外/未登记姓名";
                let status = overrideIds.includes(id) ? "OVERRIDE" : "MISSING_IN_EMP";
                
                let moveIn = apt.moveIn;
                // 如果库外人员也缺日期，改为 NO_DATE 状态以便底部统计
                if (!moveIn || String(moveIn).trim() === "undefined") status = "NO_DATE";

                const calc = calculateRent("0", (status === "NO_DATE" ? null : moveIn), baseDate, status === "OVERRIDE" ? overrideVal : null);
                finalResults.push({ id, name, rentStr: "0", moveIn: (status === "NO_DATE" ? null : moveIn), ...calc, status });
            }
        });

        // 6. 渲染界面
        renderAccomAuditTable(finalResults);
        renderEnhancedDiagnostics(finalResults); // 确保统计函数存在

    } catch (e) {
        console.error(e);
        alert("核算失败: " + e.message);
    }
};

// 租金计算与日期解析核心逻辑
/**
 * 标准化租金计算 (V7.0)
 * 采用 5 天一档的结算逻辑
 */
// function calculateRent(rentStr, moveInDateStr, baseDate, overrideAmount) {
//     let amount = 0; 
//     let unit = "EUR";

//     // 1. 提取金额
//     if (overrideAmount !== null) { 
//         amount = overrideAmount; 
//     } else {
//         const moneyMatch = rentStr.match(/(\d+(\.\d+)?)/);
//         amount = moneyMatch ? parseFloat(moneyMatch[1]) : 0;
//         const unitMatch = rentStr.match(/[A-Za-z]+/);
//         unit = unitMatch ? unitMatch[0] : "EUR";
//     }

//     // 2. 如果日期缺失，当月预估为 0
//     if (!moveInDateStr || String(moveInDateStr).trim() === "undefined") {
//         return { current: "0.00", next: amount.toFixed(2), unit };
//     }

//     const moveIn = parseFlexibleDate(moveInDateStr);
//     const targetYear = baseDate.getFullYear();
//     const targetMonth = baseDate.getMonth();
    
//     let currentAmount = 0;

//     // 3. 核心：按入住月份判断
//     if (moveIn.getFullYear() === targetYear && moveIn.getMonth() === targetMonth) {
//         /**
//          * 5天档位结算逻辑：
//          * (30 - 入住日期) / 5 -> 取整 -> * 5
//          */
//         const dayOfMonth = moveIn.getDate();
        
//         //所有人都免5天以内，一号入住从5号算
//         const remainingDays = 30 - dayOfMonth;
//         // 如果是 1 号，直接给 30 天；否则按 (30 - 入住日期) 计算
//         // const remainingDays = (dayOfMonth === 1) ? 30 : (30 - dayOfMonth);

//         const step = Math.floor(remainingDays / 5);
//         const billingDays = step * 5; 
        
//         // 只有当 billingDays > 0 时才产生费用，防止月底最后几天入住直接免单
//         currentAmount = (amount / 30) * Math.max(0, billingDays);
        
//     } else if (moveIn < baseDate) {
//         // 之前月份入住，按全月 30 天计算
//         currentAmount = amount;
//     } else {
//         // 未来月份入住
//         currentAmount = 0;
//     }

//     return { 
//         current: currentAmount.toFixed(2), 
//         next: amount.toFixed(2), 
//         unit: unit 
//     };
// }
function calculateRent(rentStr, moveInDateStr, baseDate, overrideAmount) {
    let amount = 0; 
    let unit = "€"; // 修改：默认单位改为 €

    // 1. 提取金额
    if (overrideAmount !== null) { 
        amount = overrideAmount; 
    } else {
        const moneyMatch = rentStr.match(/(\d+(\.\d+)?)/);
        amount = moneyMatch ? parseFloat(moneyMatch[1]) : 0;
        // 修改：如果匹配到货币单位，可以保持或强制统一，这里为了视觉统一可直接用 €
        unit = "€"; 
    }

    // 内部阶梯计算逻辑（保持你的公式：(30-D)/5 取整 * 5）
    const getDaysForMonth = (mDate, targetDate) => {
        if (!mDate) return 0;
        
        const mYear = mDate.getFullYear();
        const mMonth = mDate.getMonth();
        const tYear = targetDate.getFullYear();
        const tMonth = targetDate.getMonth();

        // 未来月份入住：0天
        if (mYear > tYear || (mYear === tYear && mMonth > tMonth)) return 0;

        // 入住当月：执行 5天档位逻辑
        if (mYear === tYear && mMonth === tMonth) {
            const dayOfMonth = mDate.getDate();
            //所有人都免5天以内
            // const remainingDays = 30 - dayOfMonth;
            // 核心修改：如果是 1 号，直接给 30 天；否则按 (30 - 入住日期) 计算
            const remainingDays = (dayOfMonth === 1) ? 30 : (30 - dayOfMonth);
            const step = Math.floor(remainingDays / 5);
            return Math.max(0, step * 5);
        }

        // 之前月份入住：30天
        return 30;
    };

    // 2. 如果日期缺失，返回 0
    if (!moveInDateStr || String(moveInDateStr).trim() === "undefined" || String(moveInDateStr).trim() === "null") {
        return { current: "0.00", next: "0.00", unit: "€" };
    }

    const moveIn = parseFlexibleDate(moveInDateStr);
    
    // 3. 分别计算当月和次月
    // 计算当月 (baseDate)
    const currentBillingDays = getDaysForMonth(moveIn, baseDate);
    const currentAmount = (amount / 30) * currentBillingDays;

    // 计算次月 (baseDate + 1个月)
    const nextMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
    const nextBillingDays = getDaysForMonth(moveIn, nextMonthDate);
    const nextAmount = (amount / 30) * nextBillingDays;

    return { 
        current: currentAmount.toFixed(2), 
        next: nextAmount.toFixed(2), 
        unit: unit 
    };
}

function parseFlexibleDate(dateStr) {
    if (!dateStr || dateStr === "undefined") return new Date();
    if (String(dateStr).includes('.')) {
        const p = dateStr.split('.');
        if (p[2] && p[2].length === 4) return new Date(p[2], p[1] - 1, p[0]);
    }
    return new Date(dateStr);
}

function renderAccomAuditTable(data) {
    const rows = data.map(item => {
        let rowClass = ""; let badge = "";
        switch(item.status) {
            case "OVERRIDE": rowClass = "row-override"; badge = '<span class="badge" style="background:#13c2c2">手动覆盖</span>'; break;
            case "MISSING_IN_APT": rowClass = "row-warning"; badge = '<span class="badge" style="background:#faad14">缺住宿记录</span>'; break;
            case "MISSING_IN_EMP": rowClass = "row-special"; badge = '<span class="badge" style="background:#722ed1">库外居住</span>'; break;
            case "NO_DATE": rowClass = "row-danger"; badge = '<span class="badge" style="background:#ff4d4f">缺入住日期</span>'; break;
            default: badge = '<span class="badge" style="background:#52c41a">计算正常</span>';
        }
        const dateDisp = (!item.moveIn || item.moveIn === "undefined") ? '<span style="color:#ff4d4f">需补日期</span>' : item.moveIn;
        // return `<tr class="${rowClass}"><td>${badge}</td><td>${item.id}</td><td>${item.name}</td><td>${dateDisp}</td><td>${item.rentStr}</td><td style="font-weight:bold;color:#1890ff">${item.current} ${item.unit}</td><td style="color:#52c41a">${item.next} ${item.unit}</td></tr>`;
        return `
            <tr class="${rowClass}">
                <td>${badge}</td>
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>${item.moveIn || '需补日期'}</td>
                <td>${item.rentStr}</td>
                <td style="font-weight:bold; color:#1890ff" title="基于5天档位逻辑计算">
                    ${item.current} ${item.unit}
                </td>
                <td style="color:#52c41a">${item.next} ${item.unit}</td>
            </tr>
        `;
    }).join('');
    $('#accomAuditBody').html(rows);
}

// 底部诊断看板强化
// function renderEnhancedDiagnostics(data) {
//     const noDate = data.filter(d => d.status === "NO_DATE");
//     const aptOnly = data.filter(d => d.status === "MISSING_IN_EMP");
//     const overrides = data.filter(d => d.status === "OVERRIDE");

//     const getDiagHtml = (list, type) => {
//         if (list.length === 0) return '<div class="diag-item">无相关异常</div>';
//         return list.map(i => {
//             let msg = "";
//             if(type==='date') msg = `<span class="diag-tag">ERROR:</span> 住宿表日期列为空`;
//             if(type==='emp') msg = `<span class="diag-tag">INFO:</span> Employees表未设为Yes(此人出现在apartment表了) 或 ID缺失`;
//             if(type==='over') msg = `<span class="diag-tag">SET:</span> 已强制改为固定金额`;
//             return `<div class="diag-item"><b>[${i.id}] ${i.name}</b><br/>${msg}</div>`;
//         }).join('');
//     };

//     $('#diagGrid').html(`
//         <div class="diag-card">
//             <h5 style="color:#ff4d4f"><i class="fas fa-calendar-times"></i> 入住日期异常 (${noDate.length})</h5>
//             ${getDiagHtml(noDate, 'date')}
//         </div>
//         <div class="diag-card">
//             <h5 style="color:#722ed1"><i class="fas fa-user-slash"></i> 库外/交租未开启 (${aptOnly.length})</h5>
//             ${getDiagHtml(aptOnly, 'emp')}
//         </div>
//         <div class="diag-card">
//             <h5 style="color:#13c2c2"><i class="fas fa-user-check"></i> 手动金额修正记录 (${overrides.length})</h5>
//             ${getDiagHtml(overrides, 'over')}
//         </div>
//     `);
// }
function renderEnhancedDiagnostics(data) {
    // 修正后的逻辑：
    // 1. 日期异常：包含【状态为 NO_DATE】以及【没有日期且缺记录】的人
    const noDate = data.filter(d => 
        d.status === "NO_DATE" || 
        ((d.status === "MISSING_IN_APT" || d.status === "MISSING_IN_EMP") && (!d.moveIn || String(d.moveIn) === "null" || String(d.moveIn) === "undefined"))
    );
    
    // 2. 库外/未设交租：仅统计那些确实有居住记录（有日期）但 Employees 表没勾选的人
    const aptOnly = data.filter(d => d.status === "MISSING_IN_EMP" && d.moveIn && String(d.moveIn) !== "undefined");
    
    // 3. 手动覆盖
    const overrides = data.filter(d => d.status === "OVERRIDE");

    const buildItems = (list) => {
        if (list.length === 0) return '<div class="diag-item">无相关异常</div>';
        // 增加更详细的描述，让你知道具体缺什么
        return list.map(i => {
            let reason = "";
            if (i.status === "MISSING_IN_APT") reason = "【(要交租金但是)住宿表搜不到此人 或 住宿表 员工ID对不上(修改住宿表对应人员ID)】";
            if (i.status === "NO_DATE") reason = " (入住日期为空)";
            if (i.status === "MISSING_IN_EMP") reason = " 【员工表交租设置有误(Accommodation为No但是住宿表有记录) / (Apartment姓名和员工编号不匹配)】";
            
            return `<div class="diag-item"><b>[${i.id}]</b> ${i.name}<span style="color:#999;font-size:10px;">${reason}</span></div>`;
        }).join('');
    };

    $('#diagGrid').html(`
        <div class="diag-card" style="border-color:#ff4d4f">
            <h5><i class="fas fa-calendar-times"></i> 入住日期异常 (${noDate.length})</h5>
            ${buildItems(noDate)}
        </div>
        <div class="diag-card" style="border-color:#722ed1">
            <h5><i class="fas fa-user-slash"></i> 库外/未设交租 (${aptOnly.length})</h5>
            ${buildItems(aptOnly)}
        </div>
        <div class="diag-card" style="border-color:#13c2c2">
            <h5><i class="fas fa-user-check"></i> 手动覆盖记录 (${overrides.length})</h5>
            ${buildItems(overrides)}
        </div>
    `);
}
