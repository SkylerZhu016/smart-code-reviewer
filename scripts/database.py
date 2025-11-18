import sqlite3
import os
from flask import g

# 数据库文件路径配置
DATABASE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'database')
TEACHER_DB_PATH = os.path.join(DATABASE_DIR, 'teacher.db')
STUDENT_DB_PATH = os.path.join(DATABASE_DIR, 'student.db')

def get_db(db_type='student'):
    """
    获取数据库连接。
    'teacher'库用于存储题目等共享信息。
    'student'库用于存储提交、评审等学生相关信息。
    """
    db_path = TEACHER_DB_PATH if db_type == 'teacher' else STUDENT_DB_PATH
    attr_name = f'_database_{db_type}'
    
    db = getattr(g, attr_name, None)
    if db is None:
        db = sqlite3.connect(db_path)
        db.row_factory = sqlite3.Row
        setattr(g, attr_name, db)
    return db

def query_db(query, args=(), one=False, db_type='student'):
    """执行数据库查询"""
    cur = get_db(db_type).execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv

def close_connection(exception):
    """关闭所有数据库连接"""
    for attr_name in ['_database_teacher', '_database_student']:
        db = getattr(g, attr_name, None)
        if db is not None:
            db.close()

def init_db(app):
    """初始化两个数据库的表结构"""
    if not os.path.exists(DATABASE_DIR):
        os.makedirs(DATABASE_DIR)

    with app.app_context():
        # 初始化教师数据库
        db_teacher = get_db('teacher')
        cursor_teacher = db_teacher.cursor()
        
        cursor_teacher.execute('''
            CREATE TABLE IF NOT EXISTS Problem (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description_md TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor_teacher.execute('''
            CREATE TABLE IF NOT EXISTS TestCase (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                problem_id INTEGER,
                input_data TEXT,
                expected_output TEXT,
                FOREIGN KEY (problem_id) REFERENCES Problem(id) ON DELETE CASCADE
            )
        ''')
        
        # 在教师数据库中添加AI评审表，用于存储教师端的AI评估结果
        cursor_teacher.execute('''
            CREATE TABLE IF NOT EXISTS TeacherAIReview (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id INTEGER,
                problem_id INTEGER NOT NULL,
                student_id TEXT NOT NULL,
                code_hash TEXT,
                review_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        db_teacher.commit()

        # 初始化学生数据库
        db_student = get_db('student')
        cursor_student = db_student.cursor()

        cursor_student.execute('''
            CREATE TABLE IF NOT EXISTS Submission (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                problem_id INTEGER NOT NULL,
                student_id TEXT NOT NULL,
                code TEXT NOT NULL,
                passed_tests INTEGER,
                total_tests INTEGER,
                test_details_json TEXT,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor_student.execute('''
            CREATE TABLE IF NOT EXISTS StudentAIChat (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                problem_id INTEGER NOT NULL,
                question TEXT NOT NULL,
                ai_response TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 新增：学生AI评估记录表（用于保存AI辅导结果）
        cursor_student.execute('''
            CREATE TABLE IF NOT EXISTS StudentAIReview (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                problem_id INTEGER NOT NULL,
                submission_id INTEGER,
                code TEXT NOT NULL,
                code_hash TEXT,
                review_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (submission_id) REFERENCES Submission(id) ON DELETE SET NULL
            )
        ''')
        
        db_student.commit()
