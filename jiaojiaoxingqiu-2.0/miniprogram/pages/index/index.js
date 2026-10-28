// 家教星球 · 老师端订单流（离线快照版）
const snapshot = require("../../data/snapshot.js");
const domain = require("../../utils/domain.js");
const filtersLib = require("../../utils/filters.js");

const PAGE_SIZE = 10;

Page({
  data: {
    loaded: false,
    // 看板
    todayCount: 0,
    totalCount: 0,
    todayHigh: 0,
    tickerLines: [],
    // 筛选
    filters: filtersLib.makeEmptyFilters(),
    poolOptions: [],
    districtOptions: [],
    subjectOptions: [],
    gradeOptions: domain.GRADES,
    timeOptions: domain.TIME_OPTIONS,
    typeLabels: ["不限", "大学生", "专职老师"],
    typeValues: ["", "college", "professional"],
    typeIndex: 0,
    dateLabels: ["不限", "今天", "昨天", "近3天", "近7天"],
    dateIndex: 0,
    expanded: false,
    activeTags: [],
    activeTagCount: 0,
    minMaxError: false,
    // 结果
    results: [],
    resultCount: 0,
    page: 1,
    pages: 1,
    pageCards: [],
    toast: ""
  },

  orders: [],
  dictionaries: [],
  batches: [],
  cloudOk: false,

  onLoad() {
    const data = snapshot || { orders: [], batches: [], dictionaries: [] };
    this.orders = data.orders || [];
    this.dictionaries = data.dictionaries || [];
    this.batches = data.batches || [];
    this.setData({ loaded: true });
    this.applyFilters();
    // 快照先渲染，再尝试云端刷新（开通云开发并部署 getFeed 后自动生效）
    this.refreshFromCloud(false);
  },

  onPullDownRefresh() {
    this.refreshFromCloud(true, () => wx.stopPullDownRefresh());
  },

  refreshFromCloud(showToast, done) {
    const finish = () => { if (done) done(); };
    if (!wx.cloud || !wx.cloud.callFunction) {
      if (showToast) this.setData({ toast: "当前环境不支持云服务，使用内置数据。" });
      return finish();
    }
    wx.cloud.callFunction({
      name: "getFeed",
      success: res => {
        const data = res && res.result;
        if (data && data.ok && Array.isArray(data.orders)) {
          this.orders = data.orders;
          this.dictionaries = data.dictionaries || [];
          this.batches = data.batches || [];
          this.cloudOk = true;
          this.applyFilters();
          if (showToast) this.setData({ toast: "已更新到最新数据（" + (data.generatedAt || "").slice(0, 16).replace("T", " ") + "）" });
        } else if (showToast) {
          this.setData({ toast: "云端数据格式异常，使用内置数据。" });
        }
        finish();
      },
      fail: () => {
        this.cloudOk = false;
        if (showToast) this.setData({ toast: "暂时连不上云服务，使用内置数据。" });
        finish();
      }
    });
  },

  // ---------- 选项 ----------
  choices(kind) {
    return this.dictionaries.filter(d => d.kind === kind).map(d => d.name);
  },

  buildOptions() {
    const f = this.data.filters;
    const pools = [];
    ["A", "B", "C", "owned"].forEach(p => { if (pools.indexOf(p) === -1) pools.push(p); });
    this.orders.forEach(o => { if (pools.indexOf(o.pool) === -1) pools.push(o.pool); });
    this.setData({
      poolOptions: pools.map(p => ({ value: p, label: domain.poolLabel(p), on: f.pools.indexOf(p) !== -1 })),
      districtOptions: this.markOn(this.choices("district"), f.districts),
      subjectOptions: this.markOn(this.choices("subject"), f.subjects),
      gradeOptions: this.markOn(domain.GRADES, f.grades),
      timeOptions: this.markOn(domain.TIME_OPTIONS, f.times)
    });
  },

  markOn(options, selected) {
    return options.map(o => ({ label: o, on: selected.indexOf(o) !== -1 }));
  },

  // ---------- 派生视图 ----------
  applyFilters() {
    const f = this.data.filters;
    const results = filtersLib.filterOrders(this.orders, f)
      .slice()
      .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
    const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
    const page = Math.min(this.data.page, pages);

    const today = domain.chinaDay();
    const todayOrders = this.orders.filter(o => domain.chinaDay(o.publishedAt) === today);
    const high = Math.max(0, ...todayOrders.map(o => o.hourlyMax || 0));

    const batchLines = (this.batches || [])
      .filter(b => b.items && b.items.length)
      .slice(0, 3)
      .map(b => {
        const byPool = {}, byDistrict = {};
        b.items.forEach(i => {
          const pl = domain.poolLabel(i.pool);
          byPool[pl] = (byPool[pl] || 0) + 1;
          const d = i.district || "其他";
          byDistrict[d] = (byDistrict[d] || 0) + 1;
        });
        const poolText = Object.keys(byPool).map(k => k + "更新" + byPool[k] + "单").join(" · ");
        const districtText = Object.keys(byDistrict).map(k => k + byDistrict[k]).join(" · ");
        return { id: b.id, time: domain.dateLabel(b.createdAt), text: poolText + " · " + districtText };
      });

    // 已选标签
    const tags = [];
    f.pools.forEach(v => tags.push({ group: "pools", label: domain.poolLabel(v) }));
    f.districts.forEach(v => tags.push({ group: "districts", label: v }));
    f.subjects.forEach(v => tags.push({ group: "subjects", label: v }));
    f.grades.forEach(v => tags.push({ group: "grades", label: v }));
    f.times.forEach(v => tags.push({ group: "times", label: v }));
    if (f.type) {
      const idx = this.data.typeValues.indexOf(f.type);
      tags.push({ group: "type", label: idx > 0 ? this.data.typeLabels[idx] : f.type });
    }
    if (f.min) tags.push({ group: "min", label: "≥ ¥" + f.min + "/h" });
    if (f.max) tags.push({ group: "max", label: "≤ ¥" + f.max + "/h" });
    if (f.date) tags.push({ group: "date", label: f.date });

    this.setData({
      todayCount: todayOrders.length,
      totalCount: this.orders.length,
      todayHigh: high || 0,
      tickerLines: batchLines,
      results,
      resultCount: results.length,
      pages,
      page,
      activeTags: tags,
      activeTagCount: tags.length,
      minMaxError: !!(f.min && f.max && Number(f.min) > Number(f.max))
    });
    this.buildOptions();
    this.buildPage();
  },

  buildPage() {
    const start = (this.data.page - 1) * PAGE_SIZE;
    const slice = this.data.results.slice(start, start + PAGE_SIZE);
    const today = domain.chinaDay();
    const cards = slice.map((o, i) => {
      const gender = o.gender && o.grade.indexOf(o.gender) === -1 ? " · " + o.gender : "";
      const facts = [
        ["地址", o.address],
        ["学员", o.grade + gender],
        ["科目", o.subjects.join(" / ")],
        ["情况", o.situation],
        ["目标", o.goal],
        ["时间", o.schedule],
        ["要求", o.requirement],
        ["待遇", domain.compensation(o)]
      ].filter(f => f[1]);
      return {
        idx: start + i,
        id: o.id,
        poolClass: o.pool === "owned" ? "owned" : o.pool.toLowerCase(),
        poolText: o.publicPoolLabel,
        orderCode: o.orderCode,
        isNew: domain.chinaDay(o.publishedAt) === today,
        timeText: domain.dateLabel(o.publishedAt),
        grade: o.grade,
        subjectText: o.subjects.join("、"),
        facts,
        copied: this.copiedId === o.id
      };
    });
    this.setData({ pageCards: cards });
  },

  // ---------- 快捷筛选 ----------
  scrollToFeed() {
    wx.pageScrollTo({ selector: "#feed", duration: 200, fail: () => {} });
  },

  onQuickToday() {
    const f = filtersLib.makeEmptyFilters();
    f.date = "今天";
    this.setFilters(f);
    this.scrollToFeed();
  },

  onQuickAll() {
    this.setFilters(filtersLib.makeEmptyFilters());
    this.scrollToFeed();
  },

  onQuickHighest() {
    if (!this.data.todayHigh) return;
    const f = filtersLib.makeEmptyFilters();
    f.date = "今天";
    f.min = String(this.data.todayHigh);
    this.setFilters(f);
    this.scrollToFeed();
  },

  setFilters(f) {
    this.copiedId = "";
    this.setData({
      filters: f,
      typeIndex: this.data.typeValues.indexOf(f.type) === -1 ? 0 : this.data.typeValues.indexOf(f.type),
      dateIndex: domain.DATE_OPTIONS.indexOf(f.date) === -1 ? 0 : domain.DATE_OPTIONS.indexOf(f.date),
      page: 1
    });
    this.applyFilters();
  },

  // ---------- 筛选交互 ----------
  onQuery(e) {
    this.patchFilters({ query: e.detail.value });
  },
  onClearQuery() {
    this.patchFilters({ query: "" });
  },
  onToggleExpand() {
    this.setData({ expanded: !this.data.expanded });
  },
  onClearPools() {
    this.patchFilters({ pools: [] });
  },
  onTogglePool(e) {
    const v = e.currentTarget.dataset.value;
    const pools = this.data.filters.pools.slice();
    const i = pools.indexOf(v);
    if (i === -1) pools.push(v); else pools.splice(i, 1);
    this.patchFilters({ pools });
  },
  onToggleDistrict(e) {
    this.toggleMulti("districts", e.currentTarget.dataset.value);
  },
  onToggleSubject(e) {
    this.toggleMulti("subjects", e.currentTarget.dataset.value);
  },
  onToggleGrade(e) {
    this.toggleMulti("grades", e.currentTarget.dataset.value);
  },
  onToggleTime(e) {
    this.toggleMulti("times", e.currentTarget.dataset.value);
  },
  toggleMulti(key, value) {
    const arr = this.data.filters[key].slice();
    const i = arr.indexOf(value);
    if (i === -1) arr.push(value); else arr.splice(i, 1);
    const patch = {};
    patch[key] = arr;
    this.patchFilters(patch);
  },
  onTypeChange(e) {
    const idx = Number(e.detail.value);
    this.patchFilters({ type: this.data.typeValues[idx] || "" }, { typeIndex: idx });
  },
  onDateChange(e) {
    const idx = Number(e.detail.value);
    this.patchFilters({ date: domain.DATE_OPTIONS[idx] || "" }, { dateIndex: idx });
  },
  onMinInput(e) {
    this.patchFilters({ min: e.detail.value });
  },
  onMaxInput(e) {
    this.patchFilters({ max: e.detail.value });
  },
  patchFilters(patch, extra) {
    const f = Object.assign({}, this.data.filters, patch);
    this.setData(Object.assign({ filters: f, page: 1 }, extra || {}));
    this.applyFilters();
  },
  onRemoveTag(e) {
    const tag = this.data.activeTags[e.currentTarget.dataset.index];
    if (!tag) return;
    const f = Object.assign({}, this.data.filters);
    if (tag.group === "type") f.type = "";
    else if (tag.group === "min") f.min = "";
    else if (tag.group === "max") f.max = "";
    else if (tag.group === "date") f.date = "";
    else f[tag.group] = f[tag.group].filter(x => x !== tag.label);
    this.setFilters(f);
  },
  onClearAll() {
    this.setFilters(filtersLib.makeEmptyFilters());
  },

  // ---------- 分页 ----------
  onPrevPage() {
    if (this.data.page <= 1) return;
    this.setData({ page: this.data.page - 1 });
    this.buildPage();
    this.scrollToFeed();
  },
  onNextPage() {
    if (this.data.page >= this.data.pages) return;
    this.setData({ page: this.data.page + 1 });
    this.buildPage();
    this.scrollToFeed();
  },

  // ---------- 复制 ----------
  onCopy(e) {
    const order = this.data.results[e.currentTarget.dataset.index];
    if (!order) return;
    const text = domain.publicCopy(order);
    this.copiedId = order.id;
    wx.setClipboardData({
      data: text,
      success: () => {
        this.buildPage();
        this.setData({ toast: "完整订单已复制，现在可以到微信咨询助理。" });
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this.setData({ toast: "" }), 2600);
      }
    });
  }
});
