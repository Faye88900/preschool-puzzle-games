import json
import re
from pathlib import Path

segments = json.loads(Path('artifacts/flower-choir/transcript.json').read_text(encoding='utf-8'))
words = []
for segment in segments:
    for word in segment['words']:
        chars = re.findall(r'[\u4e00-\u9fff]', word['text'])
        for i, char in enumerate(chars):
            words.append((word['start'] + (word['end'] - word['start']) * i / len(chars), word['end']))
lyrics = ['风儿轻轻吹过来', '叫醒花儿把头抬', '揉揉眼睛伸伸腰', '原来是你小可爱',
    '啦啦啦，花儿开', '跟着微风摇呀摆', '你唱一句我来和', '快乐歌声飘云外',
    '转呀转呀小风车', '风儿带着歌声来', '沿着花香向前走', '新的朋友等你来',
    '谢谢你叫醒我们！', '下次再一起唱呀！']
assert len(words) == sum(len(re.findall(r'[\u4e00-\u9fff]', s)) for s in lyrics), len(words)
cues = []
cursor = 0
for lyric in lyrics:
    times = []
    for char in lyric:
        if re.match(r'[\u4e00-\u9fff]', char):
            times.append(round(words[cursor][0], 2))
            cursor += 1
        else:
            times.append(round(words[cursor - 1][1], 2))
    cues.append({'start': times[0], 'end': round(words[cursor - 1][1], 2), 'text': lyric, 'words': times})
assert all(a['end'] <= b['start'] + .001 for a, b in zip(cues, cues[1:])), cues
out = '// Timings from local Whisper analysis of the supplied 41.96-second MP3; text matches its embedded lyrics.\n'
out += 'export const CHOIR_CUES = [\n' + ''.join('  ' + json.dumps(c, ensure_ascii=False) + ',\n' for c in cues) + '] as const;\n'
Path('src/flower-choir-cues.ts').write_text(out, encoding='utf-8')
print(json.dumps([{k: c[k] for k in ['start', 'end', 'text']} for c in cues], ensure_ascii=False))
