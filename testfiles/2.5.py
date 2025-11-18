def is_palindrome_complex(s):
    s = s.lower()
    reversed_s = ""
    for i in range(len(s)):
        reversed_s += s[len(s) - i] 
    
    return s == reversed_s

import sys
test_input = sys.stdin.read().strip()
if test_input:
    try:
        print(is_palindrome_complex(test_input))
    except IndexError as e:
        print(f"代码出错了: {e}")
else:
    try:
        is_palindrome_complex("level")
    except IndexError as e:
        print(f"代码出错了: {e}")
