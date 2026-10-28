// 家教星球 · 老师端小程序
// 数据优先从云函数 getFeed 读取（微信云开发），失败时回退到离线快照 miniprogram/data/snapshot.js
// 快照由 scripts/export_miniprogram_snapshot.py 生成
App({
  onLaunch() {
    // 云开发：开发者工具里开通云开发并部署 cloudfunctions/getFeed 后自动生效。
    // wx.cloud.init() 不传 env 时使用默认环境；云函数不可用时页面会自动回退离线快照。
    if (wx.cloud) {
      try {
        wx.cloud.init({ traceUser: true });
      } catch (e) {
        // 忽略：未开通云开发时走离线快照
      }
    }
  },
  globalData: {
    // 预留：以后部署了自有服务器，把这里改成 https 域名并在 app.json 配置 request 合法域名
    apiBase: ""
  }
});
