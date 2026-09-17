"""
Grading Engine for Quiz Submissions
Evaluates all 6 question types and provides detailed feedback and score breakdown.
"""
import re
from typing import List, Dict, Any, Tuple


def normalize_str(s: Any) -> str:
    if s is None:
        return ""
    return str(s).strip().lower()


def grade_submission(questions: List[Dict[str, Any]], user_answers: Dict[str, Any]) -> Dict[str, Any]:
    """
    Grade user answers against questions.
    Returns:
    {
        'total_score': float,
        'earned_score': float,
        'percentage': float,
        'question_results': [...]
    }
    """
    total_score = float(len(questions))
    earned_score = 0.0
    results = []

    for q in questions:
        q_id = q['id']
        q_type = q['type']
        ans = user_answers.get(q_id)
        q_score = 0.0
        q_max_score = 1.0
        is_correct = False
        explanation = ""

        if q_type == 'single_choice':
            correct_set = {normalize_str(c) for c in q.get('correctAnswers', [])}
            # user ans might be label ('A') or text ('Hà Nội')
            user_val = normalize_str(ans)
            if user_val and (user_val in correct_set):
                q_score = 1.0
                is_correct = True
            else:
                # check if label maps to correct option
                matched = False
                for opt in q.get('options', []):
                    if normalize_str(opt.get('label')) == user_val or normalize_str(opt.get('text')) == user_val:
                        if normalize_str(opt.get('label')) in correct_set or normalize_str(opt.get('text')) in correct_set:
                            matched = True
                            break
                if matched:
                    q_score = 1.0
                    is_correct = True

        elif q_type == 'multiple_choice':
            correct_set = {normalize_str(c) for c in q.get('correctAnswers', [])}
            user_list = [normalize_str(x) for x in (ans if isinstance(ans, list) else [ans] if ans else [])]
            user_set = set(user_list)

            # Score by fraction of correct items
            if correct_set:
                true_positives = len(user_set.intersection(correct_set))
                false_positives = len(user_set - correct_set)
                calculated = (true_positives - false_positives) / len(correct_set)
                q_score = max(0.0, min(1.0, calculated))
                is_correct = (q_score >= 0.99)
            else:
                q_score = 1.0 if not user_set else 0.0
                is_correct = (q_score == 1.0)

        elif q_type == 'true_false':
            statements = q.get('statements', [])
            if statements:
                # Multi-statement or single statement
                st_count = len(statements)
                correct_count = 0
                st_results = []
                ans_dict = ans if isinstance(ans, dict) else {}

                for st in statements:
                    st_id = st.get('id') or str(st.get('order'))
                    user_st_ans = normalize_str(ans_dict.get(st_id))
                    correct_st_ans = normalize_str(st.get('correctAnswer'))
                    st_correct = (user_st_ans == correct_st_ans)
                    if st_correct:
                        correct_count += 1
                    st_results.append({
                        'statement_id': st_id,
                        'content': st.get('content'),
                        'user_answer': ans_dict.get(st_id),
                        'correct_answer': st.get('correctAnswer'),
                        'is_correct': st_correct
                    })

                q_score = round(correct_count / st_count, 2) if st_count > 0 else 0.0
                is_correct = (q_score >= 0.99)
                explanation = f"Đúng {correct_count}/{st_count} mệnh đề."
            else:
                correct_set = {normalize_str(c) for c in q.get('correctAnswers', [])}
                user_val = normalize_str(ans)
                if user_val in correct_set:
                    q_score = 1.0
                    is_correct = True

        elif q_type == 'fill_blank':
            expected_blanks = q.get('correctAnswers', [])
            content_text = q.get('content', '')
            BLANK_PATTERN = r'(_{2,}\s*(?:\(\s*\d+\s*\)|\[\s*\d+\s*\])?|\[\s*(?:\.{2,}|blank|ô\s*trống|_+|\d+|\.\.\.)\s*\]|\(\s*(?:\d+|\.{2,})\s*\)|\.{3,})'
            blanks_found = re.findall(BLANK_PATTERN, content_text)
            blank_count = q.get('blankCount') or max(1, len(blanks_found), len(expected_blanks))

            if blank_count > 1 and isinstance(ans, dict):
                correct_count = 0
                for b_idx in range(1, blank_count + 1):
                    user_b_ans = normalize_str(ans.get(str(b_idx)) or ans.get(b_idx) or '')
                    if b_idx - 1 < len(expected_blanks):
                        expected_raw = str(expected_blanks[b_idx - 1])
                        variations = [normalize_str(v) for v in re.split(r'[/|;]+', expected_raw) if v.strip()]
                        if any(user_b_ans == v for v in variations):
                            correct_count += 1
                    elif user_b_ans:
                        correct_count += 1

                q_score = round(correct_count / blank_count, 2)
                is_correct = (q_score >= 0.99)
                explanation = f"Đúng {correct_count}/{blank_count} ô trống."
            else:
                if isinstance(ans, dict):
                    user_val = normalize_str(ans.get('1') or ans.get(1) or '')
                else:
                    user_val = normalize_str(ans)
                correct_list = []
                for c in expected_blanks:
                    for v in re.split(r'[/|;]+', str(c)):
                        if v.strip():
                            correct_list.append(normalize_str(v))
                if any(user_val == c for c in correct_list):
                    q_score = 1.0
                    is_correct = True

        elif q_type == 'drag_drop_blank':
            items = q.get('items', [])
            ans_dict = ans if isinstance(ans, dict) else {}
            item_count = len(items)
            total_item_score = 0.0
            perfect_items_count = 0

            for it in items:
                b_key = str(it.get('blank'))
                user_raw = ans_dict.get(b_key) if b_key in ans_dict else ans_dict.get(it.get('blank'))

                # Extract expected correct answers for this item
                expected_list = []
                if 'correctAnswers' in it and isinstance(it['correctAnswers'], list) and it['correctAnswers']:
                    for ca in it['correctAnswers']:
                        if isinstance(ca, str):
                            expected_list.extend([p.strip() for p in re.split(r'[,;]+', ca) if p.strip()])
                        elif ca:
                            expected_list.append(str(ca).strip())
                elif 'correctAnswer' in it and it['correctAnswer']:
                    val = it['correctAnswer']
                    if isinstance(val, list):
                        for ca in val:
                            expected_list.extend([p.strip() for p in re.split(r'[,;]+', str(ca)) if p.strip()])
                    elif isinstance(val, str):
                        expected_list = [p.strip() for p in re.split(r'[,;]+', val) if p.strip()]

                # Extract user's answers for this item
                user_list = []
                if isinstance(user_raw, list):
                    for u in user_raw:
                        if isinstance(u, str):
                            user_list.extend([p.strip() for p in re.split(r'[,;]+', u) if p.strip()])
                        elif u:
                            user_list.append(str(u).strip())
                elif isinstance(user_raw, str) and user_raw.strip():
                    user_list = [p.strip() for p in re.split(r'[,;]+', user_raw) if p.strip()]

                norm_expected = {normalize_str(w) for w in expected_list if normalize_str(w)}
                norm_user = {normalize_str(w) for w in user_list if normalize_str(w)}

                if not norm_expected:
                    item_score = 1.0 if not norm_user else 0.0
                elif norm_expected == norm_user:
                    item_score = 1.0
                    perfect_items_count += 1
                else:
                    correct_hits = len(norm_user & norm_expected)
                    wrong_hits = len(norm_user - norm_expected)
                    item_score = max(0.0, round((correct_hits - wrong_hits) / len(norm_expected), 2))

                total_item_score += item_score

            q_score = round(total_item_score / item_count, 2) if item_count > 0 else 0.0
            is_correct = (q_score >= 0.99)
            explanation = f"Hoàn thành đúng {perfect_items_count}/{item_count} câu (điểm số: {round(q_score * 10, 1)}/10)."

        elif q_type == 'matching':
            pairs = q.get('pairs', [])
            ans_dict = ans if isinstance(ans, dict) else {}
            pair_count = len(pairs)
            correct_count = 0

            for p in pairs:
                p_id = p.get('id') or p.get('left')
                user_right = normalize_str(ans_dict.get(p_id))
                corr_right = normalize_str(p.get('right'))
                if user_right == corr_right:
                    correct_count += 1

            q_score = round(correct_count / pair_count, 2) if pair_count > 0 else 0.0
            is_correct = (q_score >= 0.99)
            explanation = f"Ghép đúng {correct_count}/{pair_count} cặp."

        earned_score += q_score
        results.append({
            'question_id': q_id,
            'order': q.get('order'),
            'type': q_type,
            'content': q.get('content'),
            'options': q.get('options'),
            'statements': q.get('statements'),
            'items': q.get('items'),
            'pairs': q.get('pairs'),
            'user_answer': ans,
            'correct_answers': q.get('correctAnswers'),
            'score': q_score,
            'max_score': q_max_score,
            'is_correct': is_correct,
            'has_highlight': q.get('hasHighlight', False),
            'highlight_source': q.get('highlightSource', ''),
            'explanation': explanation
        })

    earned_score = round(earned_score, 2)
    percentage = round((earned_score / total_score * 100) if total_score > 0 else 0, 1)

    return {
        'total_score': total_score,
        'earned_score': earned_score,
        'percentage': percentage,
        'question_results': results
    }

