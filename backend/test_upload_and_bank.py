import sys
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

with open('Mau_De_Thi_Tat_Ca_Dinh_Dang.docx', 'rb') as f:
    file_bytes = f.read()

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
header = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="Mau_De_Thi_Tat_Ca_Dinh_Dang.docx"\r\n'
    f'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n'
).encode('utf-8')
footer = f'\r\n--{boundary}--\r\n'.encode('utf-8')
body = header + file_bytes + footer

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/upload',
    data=body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
)
resp = urllib.request.urlopen(req)
quiz = json.loads(resp.read().decode('utf-8'))['quiz']
print('Upload OK! Quiz ID:', quiz['id'], 'Total questions:', len(quiz['questions']))

# Check drag_drop_blank
drag_q = [q for q in quiz['questions'] if q['type'] == 'drag_drop_blank'][0]
print('Original drag_drop bank:', drag_q.get('bank'))

# Now test adding distractor words to bank and saving via PUT
drag_q['bank'].extend(['Firewall (Nhiễu)', 'Modem (Nhiễu)', 'Proxy (Nhiễu)'])
save_body = json.dumps({'title': quiz['title'], 'questions': quiz['questions']}).encode('utf-8')
save_req = urllib.request.Request(
    f"http://127.0.0.1:8000/api/quizzes/{quiz['id']}",
    data=save_body,
    headers={'Content-Type': 'application/json'},
    method='PUT'
)
save_resp = urllib.request.urlopen(save_req)
saved_quiz = json.loads(save_resp.read().decode('utf-8'))['quiz']
saved_drag_q = [q for q in saved_quiz['questions'] if q['type'] == 'drag_drop_blank'][0]
print('Saved drag_drop bank after adding distractors:', saved_drag_q.get('bank'))
assert 'Firewall (Nhiễu)' in saved_drag_q['bank']
print('SUCCESS! Bank persistence verified 100%!')

