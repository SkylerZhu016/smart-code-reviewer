def check_palindrome(input_str):
    reversed_str = input_str.reverse()
    return input_str == reversed_str

import sys
test_input = sys.stdin.read().strip()
if test_input:
    try:
        print(check_palindrome(test_input))
    except AttributeError as e:
        print(f"代码出错了: {e}")
else:
    try:
        check_palindrome("hello")
    except AttributeError as e:
        print(f"代码出错了: {e}")
