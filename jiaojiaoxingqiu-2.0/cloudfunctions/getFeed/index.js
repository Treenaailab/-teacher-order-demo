// 云函数 getFeed：返回老师端公开订单数据
// 数据内嵌自 scripts/export_miniprogram_snapshot.py 生成的 snapshot-data.js
// 更新数据：项目根目录跑 python scripts/export_miniprogram_snapshot.py
//          然后在微信开发者工具里右键 cloudfunctions/getFeed → 上传并部署：云端安装依赖
const snapshot = require("./snapshot-data.js");

exports.main = async () => {
  return {
    ok: true,
    generatedAt: snapshot.generatedAt,
    orders: snapshot.orders,
    dictionaries: snapshot.dictionaries,
    batches: snapshot.batches
  };
};
