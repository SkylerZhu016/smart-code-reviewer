import json
import time
import io
import re
import hashlib
from flask import Flask, request, jsonify, send_from_directory, Response, send_file, render_template
from .database import get_db, query_db
from .code_executor import execute_code_safely
from .ai_service import build_prompt, call_llm_api
from .pdf_generator import generate_pdf_report

def normalize_code_for_hash(code):
    """
    标准化代码格式用于生成哈希值，去除空白字符和注释的差异
    """
    if not code:
        return ""
    
    # 移除单行注释
    lines = code.split('\n')
    normalized_lines = []
    
    for line in lines:
        # 移除行尾注释（但保留字符串中的#）
        in_string = False
        escape_next = False
        comment_start = -1
        
        for i, char in enumerate(line):
            if escape_next:
                escape_next = False
                continue
                
            if char == '\\' and in_string:
                escape_next = True
                continue
                
            if char in ('"', "'") and not escape_next:
                in_string = not in_string
                continue
                
            if not in_string and char == '#' and comment_start == -1:
                comment_start = i
                break
        
        if comment_start >= 0:
            line = line[:comment_start].rstrip()
        
        # 移除前后空白
        line = line.strip()
        if line:  # 只保留非空行
            normalized_lines.append(line)
    
    # 重新组合并标准化空白
    normalized_code = '\n'.join(normalized_lines)
    return normalized_code

def generate_code_hash(code):
    """
    生成代码的标准化哈希值
    """
    normalized_code = normalize_code_for_hash(code)
    return hashlib.md5(normalized_code.encode('utf-8')).hexdigest()

def register_routes(app):
    """注册所有路由"""
    
    @app.route('/favicon.ico')
    def favicon():
        """处理favicon.ico请求"""
        # 返回204 No Content，避免404错误
        return '', 204
    
    @app.route('/.well-known/appspecific/com.chrome.devtools.json')
    def chrome_devtools():
        """处理Chrome开发者工具JSON请求"""
        # 返回空JSON，避免404错误
        return jsonify({})
    
    @app.route('/')
    def index():
        """主页路由"""
        return render_template('index.html')

    @app.route('/api/problems', methods=['GET'])
    def get_problems():
        """获取所有题目列表"""
        problems = query_db('SELECT id, title FROM Problem ORDER BY created_at DESC', db_type='teacher')
        return jsonify([dict(row) for row in problems])

    @app.route('/api/submission/<int:submission_id>', methods=['DELETE'])
    def delete_submission(submission_id):
        """删除指定提交记录"""
        db = get_db('student')
        cursor = db.cursor()
        
        cursor.execute('SELECT id FROM Submission WHERE id = ?', (submission_id,))
        if not cursor.fetchone():
            return jsonify({"status": "error", "message": "提交记录不存在"}), 404
        
        cursor.execute('DELETE FROM Submission WHERE id = ?', (submission_id,))
        db.commit()
        
        return jsonify({"status": "success", "message": "提交记录已删除"})

    @app.route('/api/problems/<int:problem_id>', methods=['GET'])
    def get_problem(problem_id):
        """获取指定题目详情"""
        problem = query_db('SELECT * FROM Problem WHERE id = ?', (problem_id,), one=True, db_type='teacher')
        if problem:
            problem_data = dict(problem)
            test_cases = query_db('SELECT * FROM TestCase WHERE problem_id = ?', (problem_id,), db_type='teacher')
            problem_data['test_cases'] = [dict(row) for row in test_cases]
            return jsonify(problem_data)
        return jsonify({"error": "Problem not found"}), 404

    @app.route('/api/problems', methods=['POST'], defaults={'problem_id': None})
    @app.route('/api/problems/<int:problem_id>', methods=['POST'])
    def save_problem(problem_id):
        """保存或更新题目"""
        data = request.get_json()
        title = data.get('title')
        description_md = data.get('description_md')
        test_cases = data.get('test_cases', [])
        
        if not title or not description_md:
            return jsonify({"status": "error", "message": "题目名称和描述不能为空"}), 400
        
        db = get_db('teacher')
        cursor = db.cursor()
        
        if problem_id:
            cursor.execute('UPDATE Problem SET title = ?, description_md = ? WHERE id = ?', (title, description_md, problem_id))
            cursor.execute('DELETE FROM TestCase WHERE problem_id = ?', (problem_id,))
        else:
            cursor.execute('INSERT INTO Problem (title, description_md) VALUES (?, ?)', (title, description_md))
            problem_id = cursor.lastrowid
        
        for tc in test_cases:
            input_data = tc.get('input_data', '')
            expected_output = tc.get('expected_output', '')
            cursor.execute('INSERT INTO TestCase (problem_id, input_data, expected_output) VALUES (?, ?, ?)', (problem_id, input_data, expected_output))
        
        db.commit()
        return jsonify({"status": "success", "problem_id": problem_id})

    @app.route('/api/problems/<int:problem_id>', methods=['DELETE'])
    def delete_problem(problem_id):
        """删除指定题目"""
        db = get_db('teacher')
        db.execute('DELETE FROM Problem WHERE id = ?', (problem_id,))
        db.commit()
        return jsonify({"status": "success", "message": "题目已删除"})

    # 代码测试端点(不保存数据)
    @app.route('/api/test/<int:problem_id>', methods=['POST'])
    def test_code(problem_id):
        """测试代码执行结果(不保存)"""
        data = request.get_json()
        code = data.get('code', '')
        if not code:
            return jsonify({"status": "error", "message": "代码不能为空"}), 400

        test_cases = query_db('SELECT * FROM TestCase WHERE problem_id = ?', (problem_id,), db_type='teacher')
        results = []
        passed = 0
        total = len(test_cases) if test_cases else 1

        if not test_cases:
            # 无测试用例时检查代码是否能正常运行
            result = execute_code_safely(code)
            is_passed = result['returncode'] == 0 and not result['stderr']
            results.append({"case": 1, "status": "passed" if is_passed else "failed", "input": "无", "expected_output": "无错误执行", "actual_output": result.get('stdout', ''), "stderr": result.get('stderr', '')})
            if is_passed: passed = 1
        else:
            # 执行所有测试用例
            for i, tc in enumerate(test_cases, start=1):
                input_data = tc['input_data']
                expected = tc['expected_output'].strip()
                result = execute_code_safely(code, input_data)
                output = result.get('stdout', '').strip()
                is_correct = (result['returncode'] == 0 and not result['stderr'] and output == expected)
                status = 'passed' if is_correct else 'failed'
                if is_correct: passed += 1
                results.append({"case": i, "status": status, "input": input_data, "expected_output": expected, "actual_output": output, "stderr": result.get('stderr', '')})

        return jsonify({"status": "success", "data": {"passed": passed, "total": total, "details": results}})

    @app.route('/api/submit/<int:problem_id>', methods=['POST'])
    def submit_code(problem_id):
        """提交代码并保存结果"""
        data = request.get_json()
        code = data.get('code', '')
        student_id = data.get('student_id', None)
        if not code:
            return jsonify({"status": "error", "message": "代码不能为空"}), 400

        test_cases = query_db('SELECT * FROM TestCase WHERE problem_id = ?', (problem_id,), db_type='teacher')
        results = []
        passed = 0
        total = len(test_cases) if test_cases else 1

        if not test_cases:
            result = execute_code_safely(code)
            is_passed = result['returncode'] == 0 and not result['stderr']
            results.append({"case": 1, "status": "passed" if is_passed else "failed", "input": "无", "expected_output": "无错误执行", "actual_output": result.get('stdout', ''), "stderr": result.get('stderr', '')})
            if is_passed: passed = 1
        else:
            for i, tc in enumerate(test_cases, start=1):
                input_data = tc['input_data']
                expected = tc['expected_output'].strip()
                result = execute_code_safely(code, input_data)
                output = result.get('stdout', '').strip()
                is_correct = (result['returncode'] == 0 and not result['stderr'] and output == expected)
                status = 'passed' if is_correct else 'failed'
                if is_correct: passed += 1
                results.append({"case": i, "status": status, "input": input_data, "expected_output": expected, "actual_output": output, "stderr": result.get('stderr', '')})

        db = get_db()
        cursor = db.cursor()
        if student_id is None or student_id.strip() == '':
            student_id_placeholder = f"student_{int(time.time())}"
        else:
            student_id_placeholder = student_id.strip()
        
        # 检查是否存在该学生对同一题目的旧提交记录，如果存在则删除
        cursor.execute(
            'SELECT id FROM Submission WHERE problem_id = ? AND student_id = ?',
            (problem_id, student_id_placeholder)
        )
        existing_submissions = cursor.fetchall()
        
        if existing_submissions:
            # 删除该学生对同一题目的所有旧提交记录
            cursor.execute(
                'DELETE FROM Submission WHERE problem_id = ? AND student_id = ?',
                (problem_id, student_id_placeholder)
            )
            # 同时删除相关的AI评审记录
            for submission in existing_submissions:
                cursor.execute(
                    'DELETE FROM StudentAIReview WHERE submission_id = ?',
                    (submission['id'],)
                )
        
        cursor.execute(
            'INSERT INTO Submission (problem_id, student_id, code, passed_tests, total_tests, test_details_json) VALUES (?, ?, ?, ?, ?, ?)',
            (problem_id, student_id_placeholder, code, passed, total, json.dumps(results, ensure_ascii=False))
        )
        submission_id = cursor.lastrowid  # 获取新提交的ID
        db.commit()
        
        return jsonify({
            "status": "success",
            "submission_id": submission_id,  # 返回submission_id
            "data": {"passed": passed, "total": total, "details": results}
        })

    @app.route('/api/submissions/<int:problem_id>', methods=['GET'])
    def get_submissions_for_problem(problem_id):
        """获取指定题目的所有提交记录"""
        problem = query_db('SELECT title FROM Problem WHERE id = ?', (problem_id,), one=True, db_type='teacher')
        if not problem:
            return jsonify({"error": "Problem not found"}), 404
        
        submissions = query_db(
            'SELECT id, student_id, submitted_at FROM Submission WHERE problem_id = ? ORDER BY submitted_at DESC',
            (problem_id,), db_type='student'
        )
        
        submission_list = [{
            "id": sub['id'],
            "display_name": f"{problem['title']}_{sub['student_id']}",
            "student_id": sub['student_id'],
            "submitted_at": sub['submitted_at']
        } for sub in submissions]
            
        return jsonify(submission_list)

    @app.route('/api/submission/<int:submission_id>', methods=['GET'])
    def get_submission_detail(submission_id):
        """获取提交记录详情"""
        submission = query_db('SELECT * FROM Submission WHERE id = ?', (submission_id,), one=True, db_type='student')
        if not submission:
            return jsonify({"error": "Submission not found"}), 404
        
        problem = query_db('SELECT title, description_md FROM Problem WHERE id = ?', (submission['problem_id'],), one=True, db_type='teacher')
        if not problem:
            return jsonify({"error": "Associated problem not found"}), 404

        return jsonify({
            "code": submission['code'],
            "test_details": json.loads(submission['test_details_json']),
            "problem_title": problem['title'],
            "problem_description": problem['description_md']
        })

    @app.route('/api/review', methods=['POST'])
    def review_code():
        """AI代码评审接口"""
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "请求体为空或格式错误"}), 400

        role = data.get('role')
        problem_id = data.get('problem_id')
        submission_id = data.get('submission_id')  # 接收 submission_id
        code = data.get('code')
        user_input = data.get('userInput', '')

        # 教师端需要submission_id，学生端可以没有（用于提问）
        if role == 'teacher' and not all([role, problem_id, code, submission_id]):
            return jsonify({"status": "error", "message": "缺少必要参数: role, problem_id, submission_id 或 code"}), 400
        elif role == 'student' and not all([role, problem_id, code]):
            return jsonify({"status": "error", "message": "缺少必要参数: role, problem_id 或 code"}), 400

        if not isinstance(code, str) or not code.strip():
            return jsonify({"status": "error", "message": "代码不能为空或格式不正确"}), 400

        invalid_patterns = ['# 请从左侧选择一个题目', '# 请在此输入你的代码', '请将您需要评审的Python代码发给我']
        if any(pattern.lower() in code.lower() for pattern in invalid_patterns):
            return jsonify({"status": "error", "message": "请输入有效的Python代码"}), 400

        # 教师端和学生端都只从数据库读取AI评估结果
        if role == 'teacher':
            # 教师端：从teacher数据库中查找缓存
            existing_review = query_db(
                'SELECT review_data FROM TeacherAIReview WHERE submission_id = ? ORDER BY created_at DESC LIMIT 1',
                (submission_id,), one=True, db_type='teacher'
            )
            if existing_review:
                try:
                    review_data = json.loads(existing_review['review_data'])
                    if isinstance(review_data, dict) and 'general_comment' in review_data:
                        return jsonify({"status": "success", "data": review_data, "message": "从缓存加载AI评估结果", "cached": True})
                except (json.JSONDecodeError, TypeError):
                    # 缓存损坏，返回原始内容
                    return jsonify({"status": "success", "data": {"general_comment": existing_review['review_data'], "raw_response": existing_review['review_data']}, "message": "从缓存加载AI评估结果（原始格式）", "cached": True})
            else:
                # 如果没有缓存，生成新的AI评估
                pass
        else:
            # 学生端：不使用缓存，每次都生成新的辅导内容
            # 这样可以确保学生每次提问都能得到针对性的回答
            pass

        problem = query_db('SELECT * FROM Problem WHERE id = ?', (problem_id,), one=True, db_type='teacher')
        if not problem:
            return jsonify({"status": "error", "message": "题目不存在"}), 400
        
        # 根据角色获取学生ID
        if role == 'teacher':
            submission = query_db('SELECT student_id FROM Submission WHERE id = ?', (submission_id,), one=True)
            if not submission:
                return jsonify({"status": "error", "message": "提交记录不存在"}), 400
            student_id = submission['student_id']
        else:
            # 学生端使用临时ID
            student_id = 'student_question'

        simulation_result = execute_code_safely(code)
        prompt = build_prompt(role, problem['description_md'], code, simulation_result, user_input=user_input)
        llm_response_content = call_llm_api(prompt)

        try:
            result_data = json.loads(llm_response_content)
            if not isinstance(result_data, dict):
                raise ValueError("AI返回的不是有效的JSON对象")
            
            # 根据角色检查必要的字段
            if role == 'teacher':
                if 'general_comment' not in result_data:
                    result_data['general_comment'] = "AI评估完成，但缺少总体评价。"
            else:  # student
                # 学生端需要检查不同的字段
                if 'explanation' not in result_data:
                    result_data['explanation'] = "AI辅导完成，但缺少解释。"
                if 'hint_or_snippet' not in result_data:
                    result_data['hint_or_snippet'] = ""
                if 'next_step_question' not in result_data:
                    result_data['next_step_question'] = ""
                    
        except (json.JSONDecodeError, ValueError) as e:
            print(f"AI响应解析失败: {e}")
            # 当AI无法响应JSON格式时，返回原始内容
            if role == 'teacher':
                result_data = {
                    "general_comment": llm_response_content,
                    "raw_response": llm_response_content,
                    "strengths": [], "areas_for_improvement": [], "total_score": 0
                }
            else:  # student
                result_data = {
                    "explanation": llm_response_content,
                    "hint_or_snippet": "",
                    "next_step_question": "",
                    "raw_response": llm_response_content
                }
        
        result_data['simulation_output'] = f"标准输出(stdout):\n{simulation_result['stdout']}\n\n标准错误(stderr):\n{simulation_result['stderr']}"
        
        # 根据角色保存到不同的数据库表
        if role == 'teacher':
            db = get_db('teacher')  # 教师端使用teacher数据库存储AI评估结果
            cursor = db.cursor()
            # 使用 submission_id 存储，并覆盖旧的评审
            cursor.execute('DELETE FROM TeacherAIReview WHERE submission_id = ?', (submission_id,))
            cursor.execute(
                'INSERT INTO TeacherAIReview (problem_id, student_id, submission_id, code_hash, review_data) VALUES (?, ?, ?, ?, ?)',
                (problem_id, student_id, submission_id, generate_code_hash(code), json.dumps(result_data, ensure_ascii=False))
            )
            db.commit()
        else:  # student
            # 学生端：保存对话记录到 StudentAIChat 表
            # 从请求中获取真实的 student_id
            real_student_id = data.get('student_id', 'student_question')
            
            # 验证学生ID是否有效
            if not real_student_id or not str(real_student_id).strip().isdigit():
                return jsonify({"status": "error", "message": "学生ID无效，请重新输入学号"}), 400
                
            db = get_db('student')
            cursor = db.cursor()
            
            # 保存对话记录到 StudentAIChat 表
            cursor.execute(
                'INSERT INTO StudentAIChat (student_id, problem_id, question, ai_response) VALUES (?, ?, ?, ?)',
                (real_student_id, problem_id, user_input, json.dumps(result_data, ensure_ascii=False))
            )
            
            # 保存AI评估结果到 StudentAIReview 表
            # 获取当前学生的最新提交记录，如果没有则使用submission_id为None
            cursor.execute(
                'SELECT id FROM Submission WHERE problem_id = ? AND student_id = ? ORDER BY submitted_at DESC LIMIT 1',
                (problem_id, real_student_id)
            )
            latest_submission = cursor.fetchone()
            
            submission_id = latest_submission['id'] if latest_submission else None
            
            cursor.execute(
                'INSERT INTO StudentAIReview (student_id, problem_id, submission_id, code, code_hash, review_data) VALUES (?, ?, ?, ?, ?, ?)',
                (real_student_id, problem_id, submission_id, code, generate_code_hash(code), json.dumps(result_data, ensure_ascii=False))
            )
            
            db.commit()
            
            # 记录保存成功的日志
            print(f"学生AI辅导内容已保存: 学生ID={real_student_id}, 题目ID={problem_id}, 提交ID={submission_id}")

        return jsonify({"status": "success", "data": result_data, "message": "批阅成功", "cached": False})

    @app.route('/api/review/<int:submission_id>', methods=['GET'])
    def get_review_by_submission(submission_id):
        """根据提交ID获取AI评审结果"""
        # 首先从teacher数据库查找
        review = query_db(
            'SELECT review_data FROM TeacherAIReview WHERE submission_id = ? ORDER BY created_at DESC LIMIT 1',
            (submission_id,), one=True, db_type='teacher'
        )
        if not review:
            # 如果teacher数据库中没有，再从student数据库查找
            review = query_db(
                'SELECT review_data FROM StudentAIReview WHERE submission_id = ? ORDER BY created_at DESC LIMIT 1',
                (submission_id,), one=True, db_type='student'
            )
        
        if review:
            try:
                review_data = json.loads(review['review_data'])
                return jsonify({"status": "success", "data": review_data})
            except (json.JSONDecodeError, TypeError):
                return jsonify({"status": "error", "message": "存储的评审数据格式错误"}), 500
        else:
            # 如果没有找到，返回空数据，前端可以据此显示空白
            return jsonify({"status": "success", "data": None})

    @app.route('/api/export_pdf', methods=['POST'])
    def export_pdf():
        """导出PDF评审报告"""
        try:
            # 获取请求数据
            data = request.get_json()
            problem_id = data.get('problem_id')
            code = data.get('code')
            if not all([problem_id, code]):
                return jsonify({"status": "error", "message": "缺少必要参数"}), 400
            
            problem = query_db('SELECT * FROM Problem WHERE id = ?', (problem_id,), one=True, db_type='teacher')
            if not problem:
                return jsonify({"status": "error", "message": "题目不存在"}), 400
            
            test_cases = query_db('SELECT * FROM TestCase WHERE problem_id = ?', (problem_id,), db_type='teacher')
            test_details = []
            passed_count = 0
            total_count = len(test_cases) if test_cases else 1
            
            if test_cases:
                for i, tc in enumerate(test_cases, start=1):
                    input_data = tc['input_data']
                    expected = tc['expected_output'].strip()
                    result = execute_code_safely(code, input_data)
                    output = result.get('stdout', '').strip()
                    status = 'passed' if result['returncode'] == 0 and output == expected else 'failed'
                    if status == 'passed': passed_count += 1
                    test_details.append({"case": i, "status": status, "input": input_data, "expected_output": expected, "actual_output": output})
            else:
                result = execute_code_safely(code)
                status = 'passed' if result['returncode'] == 0 and not result['stderr'] else 'failed'
                if status == 'passed': passed_count = 1
                test_details.append({"case": 1, "status": status, "input": "N/A", "expected_output": "No Error", "actual_output": result['stdout']})
            
            test_results = {"passed": passed_count, "total": total_count, "details": test_details}
            
            # 尝试从缓存获取AI评估报告
            code_hash = generate_code_hash(code)
            student_id = data.get('student_id', 'anonymous')
            if not student_id or student_id.strip() == '':
                student_id = 'anonymous'
            
            # PDF导出是教师端功能，应该查询teacher数据库的TeacherAIReview表
            cached_review = query_db(
                'SELECT review_data FROM TeacherAIReview WHERE problem_id = ? AND student_id = ? AND code_hash = ? ORDER BY created_at DESC LIMIT 1',
                (problem_id, student_id, code_hash), one=True, db_type='teacher'
            )
            
            ai_review = None
            if cached_review:
                try:
                    ai_review = json.loads(cached_review['review_data'])
                    if not (isinstance(ai_review, dict) and 'general_comment' in ai_review):
                        # 如果解析失败，使用原始内容作为general_comment
                        ai_review = {"general_comment": cached_review['review_data'], "areas_for_improvement": [], "strengths": [], "total_score": 0, "raw_response": cached_review['review_data']}
                except (json.JSONDecodeError, TypeError):
                    # 如果解析失败，使用原始内容作为general_comment
                    ai_review = {"general_comment": cached_review['review_data'], "areas_for_improvement": [], "strengths": [], "total_score": 0, "raw_response": cached_review['review_data']}
            
            # 如果没有找到缓存，自动运行AI评估
            if not ai_review:
                print(f"未找到缓存的AI评估结果，自动运行AI评估: 题目ID={problem_id}, 学生ID={student_id}")
                
                # 运行代码模拟
                simulation_result = execute_code_safely(code)
                
                # 构建AI评估提示
                prompt = build_prompt('teacher', problem['description_md'], code, simulation_result)
                
                # 调用AI API获取评估结果
                llm_response_content = call_llm_api(prompt)
                
                try:
                    # 解析AI响应
                    ai_review = json.loads(llm_response_content)
                    if not isinstance(ai_review, dict):
                        raise ValueError("AI返回的不是有效的JSON对象")
                    
                    # 确保有必要的字段
                    if 'general_comment' not in ai_review:
                        ai_review['general_comment'] = "AI评估完成，但缺少总体评价。"
                        
                except (json.JSONDecodeError, ValueError) as e:
                    print(f"AI响应解析失败: {e}")
                    # 当AI无法响应JSON格式时，返回原始内容
                    ai_review = {
                        "general_comment": llm_response_content,
                        "raw_response": llm_response_content,
                        "strengths": [], "areas_for_improvement": [], "total_score": 0
                    }
                
                # 添加模拟输出到评估结果
                ai_review['simulation_output'] = f"标准输出(stdout):\n{simulation_result['stdout']}\n\n标准错误(stderr):\n{simulation_result['stderr']}"
                
                # 保存AI评估结果到缓存，以便后续使用
                try:
                    # 尝试获取该学生对这个题目的最新提交记录的ID
                    db_student = get_db('student')
                    cursor_student = db_student.cursor()
                    cursor_student.execute(
                        'SELECT id FROM Submission WHERE problem_id = ? AND student_id = ? ORDER BY submitted_at DESC LIMIT 1',
                        (problem_id, student_id)
                    )
                    latest_submission = cursor_student.fetchone()
                    submission_id_to_use = latest_submission['id'] if latest_submission else None
                    
                    db = get_db('teacher')
                    cursor = db.cursor()
                    cursor.execute(
                        'INSERT INTO TeacherAIReview (problem_id, student_id, submission_id, code_hash, review_data) VALUES (?, ?, ?, ?, ?)',
                        (problem_id, student_id, submission_id_to_use, code_hash, json.dumps(ai_review, ensure_ascii=False))
                    )
                    db.commit()
                    print(f"AI评估结果已保存到缓存: 题目ID={problem_id}, 学生ID={student_id}, 提交ID={submission_id_to_use}")
                except Exception as e:
                    print(f"保存AI评估结果到缓存失败: {e}")
            
            # 生成PDF
            try:
                pdf_bytes = generate_pdf_report(problem, code, test_results, ai_review)
                return send_file(io.BytesIO(pdf_bytes), as_attachment=True, download_name=f'Code_Review_Report_{problem["title"]}.pdf', mimetype='application/pdf')
                    
            except Exception as e:
                print(f"PDF生成错误: {e}")
                return jsonify({"status": "error", "message": f"PDF生成失败: {str(e)}"}), 500
                
        except Exception as e:
            print(f"PDF导出未知错误: {e}")
            return jsonify({"status": "error", "message": f"PDF导出失败: {str(e)}"}), 500

    @app.route('/api/student/latest-submission/<int:problem_id>/<student_id>', methods=['GET'])
    def get_latest_submission(problem_id, student_id):
        """获取学生在特定题目下的最新提交记录"""
        # 清理学号参数，去除可能的额外字符
        clean_student_id = str(student_id).strip()
        
        # 验证学号是否为纯数字
        if not clean_student_id.isdigit():
            return jsonify({"status": "error", "message": "学号格式无效"}), 400
            
        submission = query_db(
            'SELECT * FROM Submission WHERE problem_id = ? AND student_id = ? ORDER BY submitted_at DESC LIMIT 1',
            (problem_id, clean_student_id), one=True, db_type='student'
        )
        if not submission:
            # 返回200状态码，但包含not_found状态，这样前端可以更好地处理
            return jsonify({"status": "not_found", "message": "未找到该学生的提交记录，这是新用户或首次提交"}), 200
        
        submission_data = dict(submission)
        review = query_db(
            'SELECT review_data FROM StudentAIReview WHERE submission_id = ?',
            (submission['id'],), one=True, db_type='student'
        )
        
        submission_data['ai_review'] = json.loads(review['review_data']) if review else None
        submission_data['test_details'] = json.loads(submission_data['test_details_json'])
        del submission_data['test_details_json']

        return jsonify({"status": "success", "data": submission_data})
    # 在routes.py中添加以下端点

    @app.route('/api/student/chat-history/<int:problem_id>/<student_id>', methods=['GET'])
    def get_student_chat_history(problem_id, student_id):
        """获取学生在特定题目下的聊天历史记录"""
        try:
            # 清理学号参数
            clean_student_id = str(student_id).strip()
            
            # 验证学号是否为纯数字
            if not clean_student_id.isdigit():
                return jsonify({"status": "error", "message": "学号格式无效"}), 400
                
            chat_history = query_db(
                'SELECT question, ai_response, created_at FROM StudentAIChat WHERE problem_id = ? AND student_id = ? ORDER BY created_at ASC',
                (problem_id, clean_student_id), db_type='student'
            )
            
            history_list = []
            for chat in chat_history:
                try:
                    ai_response = json.loads(chat['ai_response'])
                    history_list.append({
                        "question": chat['question'],
                        "ai_response": ai_response,
                        "created_at": chat['created_at']
                    })
                except json.JSONDecodeError:
                    # 如果解析失败，使用原始字符串
                    history_list.append({
                        "question": chat['question'],
                        "ai_response": {"raw_response": chat['ai_response']},
                        "created_at": chat['created_at']
                    })
            
            return jsonify({"status": "success", "data": history_list})
            
        except Exception as e:
            print(f"获取聊天历史失败: {str(e)}")
            return jsonify({"status": "error", "message": f"获取聊天历史失败: {str(e)}"}), 500

    @app.route('/api/student/review-history/<int:problem_id>/<student_id>', methods=['GET'])
    def get_student_review_history(problem_id, student_id):
        """获取学生在特定题目下的AI评估历史记录"""
        try:
            # 清理学号参数
            clean_student_id = str(student_id).strip()
            
            # 验证学号是否为纯数字
            if not clean_student_id.isdigit():
                return jsonify({"status": "error", "message": "学号格式无效"}), 400
                
            review_history = query_db(
                'SELECT code, review_data, created_at FROM StudentAIReview WHERE problem_id = ? AND student_id = ? ORDER BY created_at DESC',
                (problem_id, clean_student_id), db_type='student'
            )
            
            history_list = []
            for review in review_history:
                try:
                    review_data = json.loads(review['review_data'])
                    history_list.append({
                        "code": review['code'],
                        "review_data": review_data,
                        "created_at": review['created_at']
                    })
                except json.JSONDecodeError:
                    # 如果解析失败，使用原始字符串
                    history_list.append({
                        "code": review['code'],
                        "review_data": {"raw_response": review['review_data']},
                        "created_at": review['created_at']
                    })
            
            return jsonify({"status": "success", "data": history_list})
            
        except Exception as e:
            print(f"获取评估历史失败: {str(e)}")
            return jsonify({"status": "error", "message": f"获取评估历史失败: {str(e)}"}), 500

    @app.route('/api/cleanup_old_tables', methods=['POST'])
    def cleanup_old_tables():
        """清理旧的数据库表"""
        try:
            # 删除学生数据库中的旧AIReview表
            db = get_db('student')
            cursor = db.cursor()
            cursor.execute('DROP TABLE IF EXISTS AIReview')
            db.commit()
            
            return jsonify({
                "status": "success",
                "message": "旧表清理成功，已删除AIReview表"
            })
        except Exception as e:
            print(f"清理旧表失败: {str(e)}")
            return jsonify({"status": "error", "message": f"清理旧表失败: {str(e)}"}), 500

    @app.route('/api/migrate_database', methods=['POST'])
    def migrate_database():
        """迁移数据库结构"""
        try:
            # 更新TeacherAIReview表，允许submission_id为NULL
            db_teacher = get_db('teacher')
            cursor_teacher = db_teacher.cursor()
            
            # 检查表是否存在
            cursor_teacher.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='TeacherAIReview'")
            table_exists = cursor_teacher.fetchone()
            
            if table_exists:
                # 获取表结构
                cursor_teacher.execute("PRAGMA table_info(TeacherAIReview)")
                columns = cursor_teacher.fetchall()
                
                # 检查submission_id是否为NOT NULL
                submission_id_nullable = True
                for column in columns:
                    if column[1] == 'submission_id' and column[3] == 1:  # column[3] == 1 表示 NOT NULL
                        submission_id_nullable = False
                        break
                
                if not submission_id_nullable:
                    # 重建表，允许submission_id为NULL
                    cursor_teacher.execute('''
                        ALTER TABLE TeacherAIReview RENAME TO TeacherAIReview_old
                    ''')
                    
                    cursor_teacher.execute('''
                        CREATE TABLE TeacherAIReview (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            submission_id INTEGER,
                            problem_id INTEGER NOT NULL,
                            student_id TEXT NOT NULL,
                            code_hash TEXT,
                            review_data TEXT NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    ''')
                    
                    cursor_teacher.execute('''
                        INSERT INTO TeacherAIReview (id, submission_id, problem_id, student_id, code_hash, review_data, created_at)
                        SELECT id, submission_id, problem_id, student_id, code_hash, review_data, created_at
                        FROM TeacherAIReview_old
                    ''')
                    
                    cursor_teacher.execute('''
                        DROP TABLE TeacherAIReview_old
                    ''')
                    
                    db_teacher.commit()
                    message = "数据库迁移成功，TeacherAIReview表现在允许submission_id为NULL"
                else:
                    message = "数据库结构已是最新版本，无需迁移"
            else:
                message = "TeacherAIReview表不存在，无需迁移"
            
            return jsonify({
                "status": "success",
                "message": message
            })
        except Exception as e:
            print(f"数据库迁移失败: {str(e)}")
            return jsonify({"status": "error", "message": f"数据库迁移失败: {str(e)}"}), 500
