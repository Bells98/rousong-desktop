# 肉松 · Rousong Desktop

以肉松为原型的成年写实狸花猫桌面伙伴。Windows 桌面程序使用 C# / WPF；独立 HTML 预览使用原生 JavaScript / Canvas。日常使用离线运行，两个版本分别存档。

当前恢复的功能版本为 **v0.9（2026-10-19）**。旧下载文件名沿用 `Rousong-Desktop-v0.1.zip`，不代表包内代码版本。

## 体验与运行

- 浏览器：完整下载并解压仓库，打开根目录 `Rousong-Preview.html`。此源码预览通过相对路径加载 `source/preview.js` 和五张本地图集，需保留 `source/` 目录，无需安装依赖或联网。
- 单文件预览：运行 `python source/build-preview.py`，生成图像与代码全部内嵌的 `dist/Rousong-Preview.html`，可单独复制和打开。Windows 开发包另在 `standalone/Rousong-Preview.html` 提供此文件，包根仍保留源码预览。
- Windows：完整下载并解压源码，运行 `Start-Rousong.cmd`。启动器使用本机 .NET Framework 4.x 编译当前代码和图集，生成 `Rousong.exe`。
- 升级：先从托盘退出旧猫，保留 `Data/`。桌面存档为 `Data/state.json`，与浏览器存储独立。
- Windows 自测：在项目目录运行 `Start-Rousong.cmd --self-test`，查看 `build.log`、`TestResults/PASS.txt` 或 `FAIL.txt`。

Windows 开发程序尚未签名。用户此前遇到的“智能应用控制”拦截尚未解决；仓库恢复和自动编译不等于已解决系统信任问题。浏览器预览可独立使用。

## 已有功能

喂食、喂水、抚摸、睡眠、状态衰减、离线结算、随机走动、大小调整、偏好与存档。桌面版另有透明窗口、拖动、置顶、照顾面板和托盘。

| 动作 | 当前实现 |
| --- | --- |
| 坐姿、眨眼、行走、舔爪、睡眠 | 基础图集 |
| 伸懒腰 | 独立全身姿态，约 7 秒 |
| 追蝴蝶 | 独立姿态与蝴蝶道具，约 12 秒 |
| 玩小球 | 独立姿态与小球道具，约 11 秒 |
| 立式猫抓板 | 120 帧、30fps 时间采样，约 11 秒 |
| 打哈欠 | 16 个姿态，约 4.2 秒 |
| 躺下打滚露肚皮 | 16 个姿态，约 7.2 秒 |

网页和桌面时间表来自同一份 `source/motion-data.json`。睡眠、吃喝保护、动作打断、随机玩耍间隔和旧存档兼容规则已包含在现有实现中。

## 开发验证

安装 Node.js 22 或以上、Python 3.12，然后在仓库根目录执行：

```bash
npm ci
python source/build-motion-data.py
npm test
```

Python 时间表与预览生成只使用标准库。Node 的 `@napi-rs/canvas` 仅用于开发检查和可选磨爪资产生成；普通用户无需安装 Node/Python。

`npm test` 先构建 `dist/Rousong-Preview.html`，再运行已有状态逻辑与实际 Canvas 像素检查，覆盖源码预览路径、五张内嵌资产、动作时间表、裁切、照顾规则及存档。构建不会修改根目录源码预览。Canvas 使用模拟 DOM，不代表完整浏览器布局验收，也不能证明动作像真实猫。

GitHub Actions 配置了预览检查和 Windows WPF 编译/自测。预览检查会保留 Canvas 结果及构建的单文件 HTML；Windows 任务通过后，会保留截图、日志和含源码及单文件预览的未签名开发包。是否通过以实际运行记录为准；透明窗口、托盘、交互与用户电脑的安全策略仍需实机检查。

## 文件与素材

| 路径 | 用途 |
| --- | --- |
| `source/Rousong.cs` | Windows 程序、状态、界面与桌面自测 |
| `source/preview.js` | 网页状态和渲染逻辑 |
| `source/motion-data.json` | 共享动作时间表 |
| `source/build-motion-data.py` | 同步 JS / C# 时间表 |
| `Rousong-Preview.html` | 使用仓库内相对路径的源码预览与构建模板 |
| `source/build-preview.py` | 将模板、五张运行图集和网页逻辑打包成 `dist/Rousong-Preview.html` |
| `source/assets/` | 当前运行图集、布局和保留的原始姿态图 |
| `source/bake_scratch_contact.cjs` | 当前磨爪图集生成器，默认输出到 `qa/` |
| `source/pack-relax.py` | 打哈欠和打滚姿态图集打包 |
| `docs/DEVELOPMENT.md` | 恢复记录、验收边界和下一步 |

可选 Python 素材工具依赖见 `requirements-assets.txt`。旧 `bake_scratch_rig.cjs` 和 `bake_scratch_fullbody.cjs` 属历史版本，不应用来覆盖当前运行图集。`normalize_motion_assets.py --base` 所需的部分早期原图不在恢复包中，不能声称全部资产都可从零重建；现有成品图集已保留。

## 仍待完成

1. 确认 Windows 编译和 WPF 自测结果，再验收透明窗口、托盘与照顾操作。
2. 解决开发版分发和 Windows 信任问题。
3. 改善磨爪的抓握、承力与遮挡；目前仍有二维固定感。
4. 补齐磨爪进入、结束时连续起身与坐下的过渡。

本项目是个人定制原型。
