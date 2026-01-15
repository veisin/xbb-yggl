/**
 * DataSyncEngine V2.5 - 完整 UI 细节还原 + 彻底隔离
 */
const DataSyncEngine = {
    state: { container: null },

    // 1. 终端工具
    log: function(msg, type = 'default') {
        const $out = $('#ds-log-output');
        if (!$out.length) return;
        const time = new Date().toLocaleTimeString();
        const color = type === 'error' ? '#f5222d' : (type === 'success' ? '#52c41a' : '#52c41a');
        $out.append(`<div style="color:${color}; margin-bottom:4px; border-bottom:1px solid #2d3748;">[${time}] ${msg}</div>`);
        setTimeout(() => { $out.scrollTop($out[0].scrollHeight); }, 50);
    },

    // 2. 渲染入口
    render: async function(containerId) {
        this.state.container = $(`#${containerId}`);
        const html = `
        <div class="ds-wrapper">
            <nav class="ds-tab-nav">
                <button class="ds-tab-item ds-active" data-mod="sync">🔄 数据精准同步</button>
                <button class="ds-tab-item" data-mod="fuzzy">🔍 智能模糊匹配</button>
                <button class="ds-tab-item" data-mod="diff">⚖️ 差集对账系统</button>
            </nav>
            <div id="ds-tab-content" class="ds-main-content"></div>
            <footer class="ds-console">
                <div class="ds-console-head"><span>🖥 执行日志终端</span><button id="ds-clear-btn">清空</button></div>
                <div id="ds-log-output" class="ds-log-body"></div>
            </footer>
        </div>`;
        this.state.container.html(html);
        this.bindInternalEvents();
        await initDB();
        this.switchModule('sync');
    },

    // 3. 事件绑定
    bindInternalEvents: function() {
        const self = this;
        // 模块切换
        this.state.container.on('click', '.ds-tab-item', function() {
            self.switchModule($(this).data('mod'));
        });
        // 来源表下拉联动
        this.state.container.on('change', '#ds-src-tab', function() {
            self.updateCols($(this).val(), '#ds-src-id, #ds-src-f, #ds-src-s, #ds-src-n');
        });
        // 目标表下拉联动
        this.state.container.on('change', '#ds-target-tab', function() {
            self.updateCols($(this).val(), '#ds-target-id, #ds-target-v');
        });
        // 执行同步按钮
        this.state.container.on('click', '#ds-exec-btn', () => self.executeSync());
        // 清空日志
        this.state.container.on('click', '#ds-clear-btn', () => $('#ds-log-output').empty());
    },

    // 4. 下拉联动逻辑
    updateCols: async function(tableId, targetSelectors) {
        if (!tableId) return;
        const { schema } = await getTableFullData(tableId);
        if (schema && schema.columns) {
            const opt = `<option value="">-- 选择列 --</option>` + schema.columns.map(c => `<option value="${c}">${c}</option>`).join('');
            this.state.container.find(targetSelectors).html(opt);
            this.log(`表 [${tableId}] 结构载入成功`);
        }
    },

    // 5. 模块切换逻辑
    switchModule: async function(modType) {
        const $btns = this.state.container.find('.ds-tab-item');
        $btns.removeClass('ds-active').filter(`[data-mod="${modType}"]`).addClass('ds-active');
        const $content = $('#ds-tab-content');
        
        if (modType === 'sync') {
            const allSchemas = await getAllSchemas();
            const tableOpts = allSchemas.map(s => `<option value="${s.id}">${s.title || s.id}</option>`).join('');
            $content.html(this.getSyncUI(tableOpts));
        } else {
            $content.html(`<div class="ds-card"><h3>${modType} 模块</h3><p>此模块正在开发中...</p></div>`);
        }
    },

    // 6. 【关键渲染】详细 UI 恢复
    getSyncUI: function(tableOpts) {
        return `
        <div class="ds-card">
            <h2 class="ds-title">🔄 跨表数据精准补全</h2>
            <p class="ds-desc">说明：基于共有 ID（如 EmployeeId或ApartmentId）进行对比，从【员工表/公寓表】提取 人名/地址 数据（人名支持拼接）并自动填入【目标表(员工公寓表)】的指定列。</p>
            
            <div class="ds-grid">
                <div class="ds-pane ds-src-pane">
                    <h4 class="ds-pane-title">📂 1. 数据来源 (员工表/公寓表)</h4>
                    <div class="ds-form-group">
                        <label>选择来源表:</label>
                        <select id="ds-src-tab" class="ds-input"><option value="">-- 请选择 --</option>${tableOpts}</select>
                    </div>
                    <div class="ds-form-group">
                        <label>匹配 ID 列 ( EmployeeId 或 ApartmentId ) 选择和👉右边一样:</label>
                        <select id="ds-src-id" class="ds-input"></select>
                    </div>
                    <div class="ds-join-box">
                        <p class="ds-box-tip">提取并拼接字段 (选填):</p>
                        <label>名 (First Name):</label><select id="ds-src-f" class="ds-input"></select>
                        <label>姓 (Surname):</label><select id="ds-src-s" class="ds-input"></select>
                        <label>昵称 (Nickname):</label><select id="ds-src-n" class="ds-input"></select>
                    </div>
                </div>

                <div class="ds-pane ds-target-pane">
                    <h4 class="ds-pane-title">🎯 2. 目标接收 (待填表 员工公寓表)</h4>
                    <div class="ds-form-group">
                        <label>选择目标表(EmployeeApartment):</label>
                        <select id="ds-target-tab" class="ds-input"><option value="">-- 请选择 --</option>${tableOpts}</select>
                    </div>
                    <div class="ds-form-group">
                        <label>匹配 ID 列 ( EmployeeId 或 ApartmentId ) 选择和👈左边一样:</label>
                        <select id="ds-target-id" class="ds-input"></select>
                    </div>
                    <div class="ds-form-group">
                        <label>要填充到的目标列(Name  或  Apartment Address):</label>
                        <select id="ds-target-v" class="ds-input"></select>
                    </div>
                    <div style="margin-top:20px; padding:10px; background:#fffbe6; border:1px solid #ffe58f; border-radius:4px; font-size:12px; color:#856404;">
                        提示：同步将覆盖目标列已有数据，建议执行前先备份。
                    </div>
                </div>
            </div>
            <div class="ds-action-bar">
                <button id="ds-exec-btn" class="ds-primary-btn">立即执行同步任务</button>
            </div>
        </div>`;
    },

    // 7. 同步执行逻辑 (带拼接处理)
    executeSync: async function() {
        const cfg = {
            sTab: $('#ds-src-tab').val(), sId: $('#ds-src-id').val(),
            sF: $('#ds-src-f').val(), sS: $('#ds-src-s').val(), sN: $('#ds-src-n').val(),
            tTab: $('#ds-target-tab').val(), tId: $('#ds-target-id').val(), tV: $('#ds-target-v').val()
        };

        if (!cfg.sTab || !cfg.tTab || !cfg.sId || !cfg.tId || !cfg.tV) {
            this.log("❌ 错误：请完整选择表、匹配 ID 和目标列", "error");
            return;
        }

        this.log(`🚀 启动同步: [${cfg.sTab}] -> [${cfg.tTab}]`);
        try {
            const [srcRes, targetRes] = await Promise.all([getTableFullData(cfg.sTab), getTableFullData(cfg.tTab)]);
            
            const getIdx = (schema, name) => {
                if (!name) return -1;
                const i = schema.columns.indexOf(name);
                return i === -1 ? -1 : i + 1;
            };

            const sIdx = { id: getIdx(srcRes.schema, cfg.sId), f: getIdx(srcRes.schema, cfg.sF), s: getIdx(srcRes.schema, cfg.sS), n: getIdx(srcRes.schema, cfg.sN) };
            const tIdx = { id: getIdx(targetRes.schema, cfg.tId), v: getIdx(targetRes.schema, cfg.tV) };

            const map = new Map();
            srcRes.data.forEach(row => {
                const id = String(row[sIdx.id]).trim().toUpperCase();
                let val = "";
                if (sIdx.f !== -1 && sIdx.s === -1) {
                    val = row[sIdx.f] || "";
                } else {
                    const f = row[sIdx.f] || "", s = row[sIdx.s] || "";
                    const n = (sIdx.n !== -1 && row[sIdx.n]) ? ` (${row[sIdx.n]})` : "";
                    val = `${f} ${s}${n}`.trim();
                }
                map.set(id, val);
            });

            let count = 0;
            const finalData = targetRes.data.map(row => {
                const id = String(row[tIdx.id]).trim().toUpperCase();
                if (map.has(id) && row[tIdx.v] !== map.get(id)) {
                    row[tIdx.v] = map.get(id);
                    count++;
                }
                return row;
            });

            if (count > 0) {
                await updateTableAllData(cfg.tTab, finalData);
                this.log(`✅ 完成！更新记录数：${count}`, "success");
            } else {
                this.log("ℹ️ 数据已是最新，未发现差异。");
            }
        } catch (e) { this.log("❌ 异常：" + e.message, "error"); }
    }
};

window.renderProcessingModule = (id) => DataSyncEngine.render(id);