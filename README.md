# 智能代码批阅助手

## 项目概述

智能代码批阅助手是一个基于Flask和人工智能技术的在线编程教学平台，专为Python编程教学设计。该系统集成了自动化代码测试、AI智能评审、实时辅导和PDF报告导出等功能，为教师和学生提供全方位的编程学习支持。

### 核心功能

- **智能代码评审**：基于DeepSeek AI模型的代码质量评估
- **自动化测试**：支持自定义测试用例的代码执行和验证
- **实时AI辅导**：学生可随时向AI导师提问，获得启发式指导
- **PDF报告生成**：自动生成包含代码分析、测试结果和AI评估的详细报告
- **双角色系统**：教师端和学生端分离，满足不同用户需求
- **代码编辑器**：集成Monaco编辑器，提供专业的代码编写体验

## 技术架构

### 后端技术栈

- **框架**：Flask (Python Web框架)
- **数据库**：SQLite (轻量级关系型数据库)
- **AI服务**：DeepSeek API (大语言模型接口)
- **代码执行**：Python subprocess (安全的沙箱环境)
- **PDF生成**：FPDF库 (支持中文字体)

### 前端技术栈

- **基础**：HTML5, CSS3, JavaScript (ES6+)
- **编辑器**：Monaco Editor (VS Code同款编辑器)
- **UI框架**：自定义CSS组件系统
- **模块化**：ES6模块化架构
- **Markdown**：Marked.js (Markdown解析)

### 数据库设计

系统采用双数据库架构：

1. **教师数据库** (`teacher.db`)
   - `Problem`：题目信息表
   - `TestCase`：测试用例表
   - `TeacherAIReview`：教师端AI评估缓存表

2. **学生数据库** (`student.db`)
   - `Submission`：学生代码提交表
   - `StudentAIChat`：学生AI对话记录表
   - `StudentAIReview`：学生端AI评估记录表

## 目录结构

```
网站/
├── app.py                     # Flask应用主入口
├── startup.bat                # Windows启动脚本
├── README.md                  # 项目说明文档
├── database/                  # 数据库文件目录
│   ├── teacher.db             # 教师数据库
│   └── student.db             # 学生数据库
├── fonts/                     # 字体文件目录
│   ├── NotoSans-*.ttf         # 英文字体
│   └── SourceHanSansSC-*.otf  # 中文字体
├── scripts/                   # 后端Python模块
│   ├── __init__.py
│   ├── ai_service.py          # AI服务接口
│   ├── code_executor.py       # 代码安全执行
│   ├── config.py              # 配置文件
│   ├── database.py            # 数据库操作
│   ├── pdf_generator.py       # PDF报告生成
│   └── routes.py              # Flask路由定义
├── static/                    # 静态资源
│   ├── css/
│   │   └── style.css          # 主样式文件
│   ├── images/
│   │   ├── background.webp    # 背景图片
│   │   └── favicon.ico        # 网站图标
│   └── js/
│       ├── main.js            # 主入口文件
│       ├── marked.min.js      # Markdown解析库
│       ├── vs/                # Monaco编辑器资源 (VS Code同款)
│       └── modules/           # JavaScript模块
│           ├── ai-tutor.js
│           ├── app-state.js
│           ├── auth-manager.js
│           ├── code-runner.js
│           ├── editor-manager.js
│           ├── export-manager.js
│           ├── problem-manager.js
│           ├── student-view.js
│           ├── submission-manager.js
│           └── ui-manager.js
├── templates/                 # HTML模板
│   ├── index.html             # 主页面
│   └── prompt.json            # AI提示词模板
└── testfiles/                 # 测试用例示例
    ├── 1.1.py - 1.5.py        # 第一题示例代码
    ├── 2.1.py - 2.5.py        # 第二题示例代码
    └── 3.1.py - 3.4.py        # 第三题示例代码
```

## 安装与部署

### 环境要求

- Python 3.7+
- 现代Web浏览器 (Chrome, Firefox, Safari, Edge)
- Windows/Linux/macOS操作系统

### 依赖安装

```bash
# 安装Python依赖
pip install flask requests fpdf

# 或使用requirements.txt (如果存在)
pip install -r requirements.txt
```

### 配置说明

1. **API配置** (`scripts/config.py`)
   ```python
   API_KEY = "your-deepseek-api-key"  # 替换为实际的API密钥
   BASE_URL = "https://api.deepseek.com/v1"
   MODEL_NAME = "deepseek-chat"
   ```

2. **数据库路径**
   - 数据库文件会自动创建在 `database/` 目录下
   - 首次运行时会自动初始化表结构

### 启动方式

#### Windows系统
```bash
# 双击运行
startup.bat

# 或命令行运行
python app.py
```

#### Linux/macOS系统
```bash
python app.py
```

启动后访问：`http://localhost:5000`

## 功能详解

### 教师端功能

1. **题目管理**
   - 创建、编辑、删除编程题目
   - 支持Markdown格式的题目描述
   - 自定义测试用例（输入和预期输出）

2. **代码评审**
   - 查看学生提交的代码
   - 自动化测试结果展示
   - AI智能评估（代码质量、规范性、性能等）
   - 一键导出PDF评审报告

3. **批量管理**
   - 查看所有学生提交记录
   - 批量导出评审报告
   - 删除和管理提交记录

### 学生端功能

1. **代码编写**
   - 专业的Monaco代码编辑器
   - 语法高亮和自动补全
   - 实时代码格式化

2. **自测运行**
   - 即时执行代码并查看结果
   - 与预期输出对比
   - 错误信息提示

3. **AI辅导**
   - 针对性提问和解答
   - 启发式教学方法
   - 代码优化建议
   - 学习历史记录

4. **提交管理**
   - 提交代码进行正式测试
   - 查看历史提交记录
   - 获取AI评估反馈

### AI评估系统

系统使用DeepSeek大语言模型进行代码分析，评估维度包括：

- **代码逻辑**：算法正确性、逻辑完整性
- **代码规范**：命名规范、注释质量、结构清晰度
- **性能效率**：时间复杂度、空间复杂度、优化潜力
- **健壮性**：错误处理、边界条件、异常情况
- **可读性**：代码风格、变量命名、注释说明

## API接口文档

### 题目管理

- `GET /api/problems` - 获取所有题目列表
- `GET /api/problems/<id>` - 获取指定题目详情
- `POST /api/problems` - 创建新题目
- `POST /api/problems/<id>` - 更新题目
- `DELETE /api/problems/<id>` - 删除题目

### 代码提交与测试

- `POST /api/test/<problem_id>` - 测试代码（不保存）
- `POST /api/submit/<problem_id>` - 提交代码并保存
- `GET /api/submissions/<problem_id>` - 获取题目提交列表
- `GET /api/submission/<submission_id>` - 获取提交详情
- `DELETE /api/submission/<submission_id>` - 删除提交记录

### AI服务

- `POST /api/review` - AI代码评审
- `GET /api/review/<submission_id>` - 获取缓存的评审结果
- `POST /api/export_pdf` - 导出PDF报告

### 学生功能

- `GET /api/student/latest-submission/<problem_id>/<student_id>` - 获取最新提交
- `GET /api/student/chat-history/<problem_id>/<student_id>` - 获取聊天历史
- `GET /api/student/review-history/<problem_id>/<student_id>` - 获取评估历史

## 安全特性

1. **代码执行沙箱**
   - 使用临时文件隔离执行环境
   - 设置执行超时限制（默认10秒）
   - 严格的输入输出控制

2. **数据验证**
   - 前后端双重数据验证
   - SQL注入防护
   - XSS攻击防护

3. **访问控制**
   - 基于角色的功能分离
   - 学生ID验证机制
   - 敏感操作权限控制

## 扩展与定制

### 添加新的编程语言支持

1. 修改 `scripts/code_executor.py` 中的执行逻辑
2. 更新前端Monaco编辑器的语言配置
3. 调整AI提示词模板以适应新语言

### 自定义AI评估标准

编辑 `templates/prompt.json` 文件中的提示词模板，可以调整：
- 评估维度和权重
- 输出格式和内容
- 教学风格和语气

### 扩展数据库功能

1. 在 `scripts/database.py` 中添加新表结构
2. 在 `scripts/routes.py` 中实现相应的API接口
3. 更新前端JavaScript模块以支持新功能

## 故障排除

### 常见问题

1. **AI服务无响应**
   - 检查API密钥是否正确
   - 确认网络连接正常
   - 查看API调用限制

2. **代码执行失败**
   - 检查Python环境是否正确安装
   - 确认临时文件权限
   - 查看代码执行超时设置

3. **PDF生成错误**
   - 确认字体文件存在
   - 检查中文字体支持
   - 查看PDF生成超时设置

### 日志查看

系统日志会输出到控制台，包括：
- API调用状态
- 数据库操作记录
- 错误和异常信息
- AI服务响应状态

## 联系方式

如有问题或建议，请通过以下方式联系：
- 邮箱：[2868532894@qq.com]

---

**注意**：本系统仅用于教学目的，请确保在生产环境中部署时加强安全措施。