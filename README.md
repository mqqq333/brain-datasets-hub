# Brain Datasets Hub（脑数据集信息平台）

面向中国机构研究者的脑数据集目录与申请指南：记录每个数据集里有什么、怎么申请、需要什么资格、要花多少钱、多久能拿到。**本站只提供信息，不托管任何数据。** 具体条件一律以官方最新说明为准。

## 目录结构

```
data/datasets/       每个数据集/队列一个 YAML 文件（唯一数据源）
  _template.yaml     带注释的填写模板（校验器会跳过以 _ 开头的文件）
schema/
  dataset.schema.json   canonical 字段定义（JSON Schema draft 2020-12, v0.1）
scripts/
  validate.mjs         校验脚本：schema + 引用完整性
docs/                  方案与评审文档（只读，勿改动）
package.json           依赖与 npm 脚本
```

## 新增一个数据集

1. 复制 `data/datasets/_template.yaml` 为 `data/datasets/<id>.yaml`，文件名必须与文件内 `id` 完全一致（kebab-case）。
2. 按官方来源逐字段填写；未知信息显式写 `unknown`，关键字段附 `source_refs` 与 `as_of`。
3. 运行 `npm run validate`：检查必填项、枚举、URI/日期格式、拼写错误，以及 `channels`/`covers`/`source_refs` 的引用是否都存在。
4. 通过后提交；字段级证据与核实日期会随 git history 保留。

依赖安装：`npm install`（需要 Node.js 与 npm）。

## 校验

```bash
npm run validate
```

按文件打印 `OK` / `FAIL` 及具体错误，任一错误即以退出码 1 结束；`data/datasets/` 为空时仅打印提示并正常退出。
