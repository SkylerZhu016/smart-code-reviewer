import json
import time
import requests
from .config import API_KEY, BASE_URL, MODEL_NAME, PDF_GENERATION_TIMEOUT, PROMPT_FILE

def load_prompts():
    """加载AI提示词模板"""
    try:
        with open(PROMPT_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        # 默认提示词
        return {
            'teacher_review_prompt': '你是一个Python代码评审助手。',
            'student_question_prompt': '你是一个Python编程辅导助手。'
        }

def build_prompt(role, problem_description, code, simulation_result, criteria='', user_input=''):
    """构建AI提示词"""
    prompts = load_prompts()
    
    # 格式化代码执行结果
    simulation_output = f"标准输出(stdout):\n{simulation_result['stdout']}\n\n标准错误(stderr):\n{simulation_result['stderr']}"
    if simulation_result['returncode'] != 0:
        simulation_output += f"\n\n退出代码(returncode): {simulation_result['returncode']} (非零表示程序异常终止)"
    
    if role == 'teacher':
        template = prompts.get('teacher_review_prompt', '')
        # 使用字符串替换避免JSON花括号冲突
        prompt = template.replace('{problem_description}', problem_description)
        prompt = prompt.replace('{code}', code)
        prompt = prompt.replace('{automated_test_results}', simulation_output)
        prompt = prompt.replace('{criteria}', criteria)
        return prompt
    else:
        template = prompts.get('student_question_prompt', '')
        # 使用字符串替换避免JSON花括号冲突
        prompt = template.replace('{problem_description}', problem_description)
        prompt = prompt.replace('{code}', code)
        prompt = prompt.replace('{automated_test_results}', simulation_output)
        prompt = prompt.replace('{user_question}', user_input)
        return prompt

def call_llm_api(prompt, max_retries=3):
    """调用AI API获取代码评审"""
    headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {API_KEY}'}
    payload = {"model": MODEL_NAME, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2}
    
    for attempt in range(max_retries):
        try:
            response = requests.post(f"{BASE_URL}/chat/completions", headers=headers, json=payload, timeout=PDF_GENERATION_TIMEOUT)
            response.raise_for_status()
            response_data = response.json()
            content = response_data.get('choices', [{}])[0].get('message', {}).get('content', '')
            if not content:
                print("AI服务返回了空内容")
                return json.dumps({"general_comment": "AI服务返回了空内容，请稍后重试。"})
            print(f"AI响应成功，内容长度: {len(content)}")
            return content
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            print("AI服务响应超时")
            return json.dumps({"general_comment": "AI服务响应超时，请稍后重试。"})
        except requests.exceptions.RequestException as e:
            print(f"调用AI服务失败: {str(e)}")
            return json.dumps({"general_comment": f"调用AI服务失败: {str(e)}"})
        except json.JSONDecodeError as e:
            print(f"AI响应JSON解析失败: {str(e)}")
            return json.dumps({"general_comment": "AI服务返回了无效的JSON格式，请稍后重试。"})
    print("AI服务暂时不可用")
    return json.dumps({"general_comment": "AI服务暂时不可用，请稍后重试。"})