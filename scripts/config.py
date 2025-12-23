import os

# 获取项目根目录(上一级目录，即app.py所在目录)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# API配置
API_KEY = "your_key"
BASE_URL = "https://api.deepseek.com/v1"
MODEL_NAME = "deepseek-chat"

# 超时设置(秒)
CODE_EXECUTION_TIMEOUT = 10
PDF_GENERATION_TIMEOUT = 300

# 路径配置
DATABASE_DIR = os.path.join(PROJECT_ROOT, 'database')
TEACHER_DB_PATH = os.path.join(DATABASE_DIR, 'teacher.db')
STUDENT_DB_PATH = os.path.join(DATABASE_DIR, 'student.db')
FONTS_DIR = os.path.join(PROJECT_ROOT, 'fonts')
TEMPLATES_DIR = os.path.join(PROJECT_ROOT, 'templates')
STATIC_DIR = os.path.join(PROJECT_ROOT, 'static')
TESTFILES_DIR = os.path.join(PROJECT_ROOT, 'testfiles')

# 字体文件路径
FONT_PATHS = {
    'regular': os.path.join(FONTS_DIR, 'NotoSans-Regular-2.ttf'),
    'bold': os.path.join(FONTS_DIR, 'NotoSans-Bold-5.ttf'),
    'italic': os.path.join(FONTS_DIR, 'NotoSans-Italic-3.ttf'),
    'bold_italic': os.path.join(FONTS_DIR, 'NotoSans-BoldItalic-4.ttf'),
    'chinese': os.path.join(FONTS_DIR, 'SourceHanSansSC-Regular-2.otf')
}

# 提示词文件路径
PROMPT_FILE = os.path.join(TEMPLATES_DIR, 'prompt.json')
