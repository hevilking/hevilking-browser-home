# hevilking的浏览器首页

一个轻盈、简约的浏览器首页，具有搜索功能、网站快捷方式和壁纸切换功能。为浏览器扩展。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 功能

### 基础功能
- **搜索引擎切换**：支持Google、百度、必应和DuckDuckGo搜索引擎
- **网站快捷方式**：支持自定义添加、删除、修改网站快捷方式，数据存储在浏览器本地
- **搜索历史记录**：自动保存搜索历史，支持查看和删除历史记录

### 壁纸功能
- **壁纸切换**：支持在线壁纸和本地壁纸切换
- **自动回退**：在线壁纸获取失败时自动使用本地壁纸
- **多种壁纸源**：集成Picsum随机图片API和本地壁纸

### 浏览器扩展功能
- **Chrome/Edge扩展**：可作为浏览器新标签页扩展使用
- **一键安装**：支持开发者模式快速安装

## 项目结构

### 基础版本
```
BrowserHome/
├── index.html              # 主页面文件
├── css/
│   ├── style.css           # 主样式文件
│   └── immersive-search.css # 沉浸式搜索样式
├── js/
│   ├── main.js             # 主JavaScript逻辑
│   └── immersive-search.js # 沉浸式搜索功能
├── assets/
│   └── images/             # 壁纸和图标文件夹
└── README.md               # 项目说明文档
```

### 浏览器扩展版本
```
BrowserHome/
├── manifest.json           # 扩展配置文件
├── background.js           # 后台脚本
├── README_EXTENSION.md     # 扩展安装说明
└── (其他基础版本文件)
```

## 使用方法

### 作为浏览器扩展使用
详细安装和使用说明请参考 [README_EXTENSION.md](README_EXTENSION.md) 文件

**快速安装步骤：**
1. 打开Chrome或Edge浏览器
2. 进入扩展管理页面 (`chrome://extensions/` 或 `edge://extensions/`)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹 
6. 安装完成后，新标签页将显示自定义首页

## 技术实现

### 前端技术
- **HTML5**：页面结构
- **CSS3**：样式设计，使用Flexbox和Grid布局，backdrop-filter实现毛玻璃效果
- **原生JavaScript**：交互逻辑，使用localStorage存储快捷方式数据

### 浏览器扩展技术
- **Manifest V3**：现代浏览器扩展标准
- **Service Worker**：后台脚本管理
- **Content Security Policy**：安全策略适配

## 注意事项

### 基础版本
- 本地壁纸文件存放在 `assets/images/` 文件夹中，可以添加或删除壁纸文件
- 快捷方式数据存储在浏览器的localStorage中，清除浏览器数据会丢失快捷方式
- 在线壁纸功能需要网络连接，如果网络不可用会自动切换到本地壁纸

### 浏览器扩展版本
- 扩展安装需要开启开发者模式
- 扩展更新后需要重新加载扩展
- 扩展功能受浏览器安全策略限制，部分外部资源可能无法加载
- 详细故障排除请参考 [README_EXTENSION.md](README_EXTENSION.md)