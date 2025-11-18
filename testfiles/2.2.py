def is_palindrome_simple(text):
    if text == text[::-1]:
        return True
    else:
        return False

import sys
test_input = sys.stdin.read().strip()
if test_input:
    print(is_palindrome_simple(test_input))
else:
    print(is_palindrome_simple('madam'))
    print(is_palindrome_simple('Level'))
