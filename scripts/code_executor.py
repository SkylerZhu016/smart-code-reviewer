import os
import subprocess
import tempfile
from .config import CODE_EXECUTION_TIMEOUT

def execute_code_safely(code, input_data=None):
    """安全执行Python代码"""
    # 创建临时文件
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as tmp_file:
        tmp_file.write(code)
        tmp_file_path = tmp_file.name
    
    try:
        input_bytes = input_data.encode('utf-8') if input_data is not None else None
        result = subprocess.run(
            ['python', tmp_file_path],
            input=input_bytes,
            capture_output=True,
            timeout=CODE_EXECUTION_TIMEOUT,
        )
        stdout = result.stdout.decode('utf-8', errors='replace')
        stderr = result.stderr.decode('utf-8', errors='replace')
        return {"stdout": stdout, "stderr": stderr, "returncode": result.returncode}
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": f"代码执行超时（超过 {CODE_EXECUTION_TIMEOUT} 秒）", "returncode": -1}
    except Exception as e:
        return {"stdout": "", "stderr": f"执行代码时发生未知错误: {str(e)}", "returncode": -2}
    finally:
        # 清理临时文件
        if os.path.exists(tmp_file_path):
            os.remove(tmp_file_path)