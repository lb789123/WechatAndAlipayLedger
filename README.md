这是一个关于微信交易、支付宝交易账单的记账本。
支持多账户管理、多币种记账、预算管理、数据可视化等功能。数据库是本地的不需要担心数据泄露

## 功能特性

（1）个人账户余额统计，支持定义多个账户，如支付宝、微信、银行卡等等
（2）交易账单的导入，支持**xlsx的一键导入（仅包含表头，需要手动删掉微信/支付宝导出的前面部分）**
（3）交易分类自定义（支持多种交易分类的自定义、模糊定义、模糊查询）交易分类自定义（支持多种交易分类的自定义、模糊定义、模糊查询）
（4）整体数据导入/导出保存
（5）每个月收支情况的报表、预算查看、每个月的消费查询、交易明细查看
（6）所有流水都支持修改和重新编辑

## 使用方式

### 1. 作为网页使用
直接在浏览器中打开 `index.html` 文件即可使用。数据存储在浏览器的 IndexedDB 中（数据库名：`ledger_v1`）。

### 2. 作为浏览器扩展使用（推荐）

**为什么使用扩展？**
- 扩展有独立的存储空间，清除浏览器网站数据不会删除扩展数据
- 扩展数据与网页数据完全隔离，更安全可靠
- 点击工具栏图标即可快速打开记账本

**安装步骤（Chrome/Edge）：**
1. 打开浏览器，进入扩展管理页面：
   - Chrome: 访问 `chrome://extensions/`
   - Edge: 访问 `edge://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择本项目的根目录（包含 manifest.json 的文件夹）
5. 扩展加载成功后，点击工具栏的扩展图标即可打开记账本

**安装步骤（Firefox）：**
1. 打开 Firefox，访问 `about:debugging`
2. 点击"此 Firefox"（This Firefox）
3. 点击"临时载入附加组件"（Load Temporary Add-on）
4. 选择本项目根目录下的 `manifest.json` 文件
5. 扩展加载成功后，点击工具栏的扩展图标即可打开记账本

**扩展数据说明：**
- 扩展使用独立的 IndexedDB 数据库（数据库名：`ledger_ext_v1`）
- 扩展数据与网页版数据是分离的，互不影响
- 清除浏览器网站数据或缓存不会删除扩展数据
- 如需备份数据，请在"设置"页面使用"导出 JSON"功能
- 卸载扩展会删除扩展数据，请务必提前备份

**查看扩展数据库：**
1. 在扩展打开的页面中，按 F12 打开开发者工具
2. 切换到"Application"（应用）标签
3. 左侧选择"Storage" → "IndexedDB"
4. 可以看到 `ledger_ext_v1` 数据库及其中的数据

## 代码目录结构

```
ledger/
├── manifest.json       # Chrome/Firefox 扩展配置文件
├── background.js       # 扩展后台服务（处理工具栏点击）
├── index.html          # 主HTML文件
├── css/
│   └── main.css        # 所有样式文件
└── js/
    ├── utils.js        # 工具函数
    ├── db.js           # IndexedDB数据库操作（网页版）
    ├── extension-idb.js # IndexedDB适配器（扩展版）
    ├── state.js        # 全局状态管理
    ├── theme.js        # 主题管理
    ├── fx.js           # 汇率相关功能
    ├── account.js      # 账户管理
    ├── transaction.js  # 交易管理
    ├── budget.js       # 预算管理
    ├── category.js     # 分类管理
    ├── reports.js      # 报表功能
    ├── import-export.js # 导入导出功能
    ├── render.js       # 渲染函数
    ├── events.js       # 事件绑定
    └── main.js         # 主入口文件
```

## 使用的情况截图：
<img width="1745" height="750" alt="image" src="https://github.com/user-attachments/assets/68eb08aa-c077-4e5e-b094-d1f193ee9600" />
<img width="714" height="291" alt="image" src="https://github.com/user-attachments/assets/dd0e26ff-97d1-4a63-b0c7-07962f51b83e" />
<img width="1625" height="1169" alt="ScreenShot_2026-01-10_220719_351" src="https://github.com/user-attachments/assets/a311afc2-5320-4911-ae57-5aa9a146afef" />
<img width="1681" height="1210" alt="ScreenShot_2026-01-10_220732_115" src="https://github.com/user-attachments/assets/3507b2b7-45f9-45ad-bc58-7fef4e50d5dd" />
<img width="1526" height="1283" alt="各分类下的消费情况，及月度消费查询" src="https://github.com/user-attachments/assets/d43d3955-badf-4efa-b436-769a732211d9" />
<img width="1561" height="395" alt="数据导出与导入，与清空" src="https://github.com/user-attachments/assets/d04cc5d4-a458-482b-9b0e-00067841494d" />
<img width="1610" height="1280" alt="账户余额" src="https://github.com/user-attachments/assets/0f2e6b02-55ed-417a-b7e5-ae80184edd63" />
<img width="1595" height="1026" alt="新增交易记录" src="https://github.com/user-attachments/assets/3e073caa-ebae-4648-8034-08e2ec695efa" />
<img width="1479" height="1193" alt="交易分类" src="https://github.com/user-attachments/assets/2c1f4973-294c-45f1-a5f9-4f98da380983" />
<img width="1631" height="1084" alt="年度消费趋势" src="https://github.com/user-attachments/assets/cd51852a-5912-475b-aa36-90d43733b343" />
<img width="1489" height="1115" alt="导入交易记录" src="https://github.com/user-attachments/assets/3eff6712-6056-4963-b5e6-bb689b02df4c" />


## 新增功能调整
（1）预算考虑收入和支出的总和，并可以进行月度、年度查看
（2）各分类下的消费情况，及月度消费查询
（3）各交易记录支持修改
<img width="1601" height="745" alt="交易明细支持修改" src="https://github.com/user-attachments/assets/37364875-b9dd-4d45-8d54-6774fc909c8e" />
<img width="1614" height="1203" alt="流水按时间、类型、分类筛选" src="https://github.com/user-attachments/assets/3c792566-053f-47ea-a786-119f21c504e7" />
<img width="1535" height="1254" alt="预算考虑收入和支出的总和，并可以进行月度、年度查看" src="https://github.com/user-attachments/assets/6ea5209a-0543-49be-a90e-42a4b0e10630" />