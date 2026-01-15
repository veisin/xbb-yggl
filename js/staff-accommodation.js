/**
 * AccommodationEngine - 住宿核算与诊断专家系统 (彻底隔离版)
 */
const AccommodationEngine = {
    state: { container: null },

    // 1. 初始化入口
    render: async function(containerId) {
        this.state.container = $(`#${containerId}`);
        const allTables = await getAllSchemas(); // 使用 db.js 里的安全函数
        const tableOptions = allTables.map(t => `<option value="${t.id}">${t.title || t.id}</option>`).join('');

        const html = `
        <div class="ac-outer-wrapper">
            <div class="ac-top-area">
                <aside class="ac-settings-side">
                    <div class="ac-side-card">
                        <h4 class="ac-side-title">📊 数据源配置</h4>
                        <label class="ac-label">请选择 员工表 (Employees)</label>
                        <select id="ac-table-emp" class="ac-ui-select">${tableOptions}</select>
                        
                        <label class="ac-label">请选择 员工公寓表 (EmployeeApartment)</label>
                        <select id="ac-table-apt" class="ac-ui-select">${tableOptions}</select>
                        
                        <label class="ac-label">选择 计算月份</label>
                        <input type="month" id="ac-calc-month" class="ac-ui-input" value="${new Date().toISOString().slice(0, 7)}">
                    </div>
                    
                    <div class="ac-side-card">
                        <h4 class="ac-side-title">⚙️ 特殊金额计算规则</h4>
                        <label class="ac-label">例外的员工 ID (每行一个)</label>
                        <textarea id="ac-override-ids" class="ac-ui-area" placeholder="例如: EMP0010"></textarea>
                        
                        <label class="ac-label">统一覆盖金额</label>
                        <input type="number" id="ac-override-val" class="ac-ui-input" value="0">
                        
                        <button id="ac-run-btn" class="ac-btn-run">开始计算并诊断</button>
                    </div>
                </aside>

                <main class="ac-result-main">
                    <div class="ac-stats-bar" id="ac-stats-bar">
                        </div>
                    <div class="ac-table-container">
                        <table class="ac-audit-table">
                            <thead>
                                <tr>
                                    <th>状态</th>
                                    <th>工号</th>
                                    <th>姓名</th>
                                    <th>入住日期</th>
                                    <th>标准租金</th>
                                    <th>当月预估</th>
                                    <th>次月标准</th>
                                </tr>
                            </thead>
                            <tbody id="ac-audit-body">
                                <tr><td colspan="7" style="text-align:center; padding:40px; color:#999;">请配置数据源并点击“开始计算”</td></tr>
                            </tbody>
                        </table>
                    </div>
                </main>
            </div>

            <footer class="ac-diag-panel">
                <h4 class="ac-diag-title"><i class="fas fa-microscope"></i> 结算异常明细诊断看板</h4>
                <div class="ac-diag-grid" id="ac-diag-grid">
                    </div>
            </footer>
        </div>`;

        this.state.container.html(html);
        this.bindEvents();
    },

    // 2. 内部事件绑定
    bindEvents: function() {
        const self = this;
        this.state.container.on('click', '#ac-run-btn', () => self.runAudit());
    },

    // 3. 核心计算逻辑
    runAudit: async function() {
        try {
            const empId = $('#ac-table-emp').val();
            const aptId = $('#ac-table-apt').val();
            const baseMonth = $('#ac-calc-month').val();
            const overrideIds = $('#ac-override-ids').val().toUpperCase().split('\n').filter(s => s.trim());
            const overrideAmt = parseFloat($('#ac-override-val').val()) || 0;

            const [empRes, aptRes] = await Promise.all([getTableFullData(empId), getTableFullData(aptId)]);

            // 索引定位（基于你提供的表结构）
            const getIdx = (s, name) => s.columns.findIndex(c => c.toLowerCase().includes(name.toLowerCase())) + 1;
            const iE = { id: getIdx(empRes.schema, "employeeid"), first: getIdx(empRes.schema, "first name"), sur: getIdx(empRes.schema, "surname"), acc: getIdx(empRes.schema, "accommodation"), rent: getIdx(empRes.schema, "rent") };
            const iA = { id: getIdx(aptRes.schema, "employeeid"), name: getIdx(aptRes.schema, "name"), date: getIdx(aptRes.schema, "move in date") };

            const empMap = new Map();
            const aptMap = new Map();
            const results = [];

            // 解析员工表：筛选需要住宿的人 (Accommodation !== 'No')
            empRes.data.forEach(row => {
                const id = String(row[iE.id]).trim().toUpperCase();
                const accStatus = String(row[iE.acc] || 'No').trim().toUpperCase();
                if (accStatus !== 'NO' && id) {
                    empMap.set(id, {
                        id,
                        name: `${row[iE.first] || ''} ${row[iE.sur] || ''}`.trim(),
                        rentStr: row[iE.rent] || "300 €",
                        accValue: String(row[iE.acc] || '').trim(), // 保存原始值（如 Not Sure）
                        processed: false
                    });
                }
            });

            // 解析住宿表
            aptRes.data.forEach(row => {
                const id = String(row[iA.id]).trim().toUpperCase();
                if (id) {
                    aptMap.set(id, { id, name: row[iA.name], moveIn: row[iA.date], processed: false });
                }
            });

            // 交叉核对逻辑
            empMap.forEach((emp, id) => {
                const apt = aptMap.get(id);
                let status = "NORMAL";
                if (overrideIds.includes(id)) status = "OVERRIDE";
                else if (!apt) status = "MISSING_RECORD";
                else if (!apt.moveIn || apt.moveIn === "undefined") status = "NO_DATE";

                const calc = this.calculate(emp.rentStr, (apt ? apt.moveIn : null), baseMonth, status === "OVERRIDE" ? overrideAmt : null);
                results.push({ ...emp, moveIn: apt ? apt.moveIn : null, ...calc, status });
                if (apt) apt.processed = true;
            });

            // 处理库外人员（住宿表有，但员工表没设为住宿）
            aptMap.forEach((apt, id) => {
                if (!apt.processed) {
                    const calc = this.calculate("300 €", apt.moveIn, baseMonth, overrideIds.includes(id) ? overrideAmt : null);
                    results.push({ id, name: apt.name || "未关联人员", rentStr: "300 €", moveIn: apt.moveIn, ...calc, status: "EXT_STAY" });
                }
            });

            this.renderUI(results);
        } catch (e) { alert("计算出错: " + e.message); }
    },

    // 4. 房租算法与货币处理
    calculate: function(rentStr, moveInStr, baseMonth, override) {
        // 货币提取
        const moneyPart = String(rentStr).match(/(\d+(\.\d+)?)/);
        const amount = override !== null ? override : (moneyPart ? parseFloat(moneyPart[1]) : 300);
        const unit = String(rentStr).match(/[^\d\s\.]+/)?.[0] || "€";

        if (!moveInStr || moveInStr === "undefined") return { current: 0, next: amount, unit };

        const baseDate = new Date(baseMonth + "-01");
        const [d, m, y] = moveInStr.split('.');
        const moveDate = new Date(y, m - 1, d);

        let currentAmount = 0;
        // 核心公式: (30 - 入住日) / 5 取整 * 5
        if (moveDate.getFullYear() === baseDate.getFullYear() && moveDate.getMonth() === baseDate.getMonth()) {
            const day = moveDate.getDate();
            const remaining = (day === 1) ? 30 : Math.max(0, 30 - day);
            currentAmount = (amount / 30) * (Math.floor(remaining / 5) * 5);
        } else if (moveDate < baseDate) {
            currentAmount = amount;
        }

        return { 
            current: this.formatSmartAmount(currentAmount), // 调用新的舍入逻辑
            next: this.formatSmartAmount(amount),           // 标准金额也按此逻辑
            unit: unit 
        };
    },
    // 房租金额舍入逻辑 (小于100省略个位，大于100省略十位)
    formatSmartAmount: function(val) {
        let num = parseFloat(val);
        if (isNaN(num) || num <= 0) return "0";

        if (num < 100) {
            // 小于 100：省略个位（例如 87 -> 80）
            return Math.floor(num / 10) * 10;
        } else {
            // 大于等于 100：省略十位以后（例如 285 -> 200, 1340 -> 1300）
            return Math.floor(num / 100) * 100;
        }
    },

    // 5. 渲染结果
    renderUI: function(data) {
        const $body = $('#ac-audit-body');
        const rows = data.map(item => {
            let cls = "", tag = "";
            // 判断是否为非标准的住宿确认值
            const isSpecialAcc = item.accValue && item.accValue.toUpperCase() !== 'YES';
            const accDisplay = isSpecialAcc ? ` (${item.accValue})` : "";
            switch(item.status) {
                case "NORMAL": tag = isSpecialAcc ? `<span class="ac-tag" style="background:#ff7a45">待确认${accDisplay}</span>` : `<span class="ac-tag ac-tag-ok">计算正常</span>`; break;
                case "MISSING_RECORD": cls = "ac-row-warn"; tag = `<span class="ac-tag ac-tag-warn">缺住宿记录${accDisplay}</span>`; break;
                case "NO_DATE": cls = "ac-row-danger"; tag = '<span class="ac-tag ac-tag-err">缺入住日期</span>'; break;
                case "EXT_STAY": cls = "ac-row-special"; tag = '<span class="ac-tag ac-tag-spec">库外居住</span>'; break;
                case "OVERRIDE": cls = "ac-row-over"; tag = '<span class="ac-tag ac-tag-over">手动覆盖</span>'; break;
            }
            return `<tr class="${cls}">
                <td>${tag}</td><td>${item.id}</td><td>${item.name}</td>
                <td>${item.moveIn || '--'}</td><td>${item.rentStr}</td>
                <td style="font-weight:bold;color:#1890ff">${item.current} ${item.unit}</td>
                <td style="color:#52c41a">${item.next} ${item.unit}</td>
            </tr>`;
        }).join('');
        $body.html(rows);

        // 更新看板
        this.renderDiag(data);
    },

    renderDiag: function(data) {
        const errs = data.filter(d => d.status === "NO_DATE");
        const warns = data.filter(d => d.status === "MISSING_RECORD");
        const exts = data.filter(d => d.status === "EXT_STAY");

        $('#ac-diag-grid').html(`
            <div class="ac-diag-card ac-border-red">
                <h5>❌ 日期异常 (${errs.length})</h5>
                ${errs.map(i => `<div class="ac-diag-item"><b>${i.id}</b> ${i.name}<br/>原因: 住宿表入住日期未填写</div>`).join('') || '无异常'}
            </div>
            <div class="ac-diag-card ac-border-yellow">
                <h5>⚠️ 缺住宿记录 (${warns.length})</h5>
                ${warns.map(i => `<div class="ac-diag-item"><b>${i.id}</b> ${i.name}<br/>原因: 员工表设为Yes但住宿表搜不到</div>`).join('') || '无异常'}
            </div>
            <div class="ac-diag-card ac-border-purple">
                <h5>ℹ️ 库外居住 (${exts.length})</h5>
                ${exts.map(i => `<div class="ac-diag-item"><b>${i.id}</b> ${i.name}<br/>原因: 住宿表有记录但员工表未开启交租</div>`).join('') || '无异常'}
            </div>
        `);
    }
};

window.renderAccommodationModule = (id) => AccommodationEngine.render(id);