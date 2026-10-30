import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(os.environ['TEMP']) / 'bean-rush-choir-tools'))
import av
import numpy as np
from faster_whisper import WhisperModel

source = Path('public/audio/maze/flower-choir.mp3')
with av.open(str(source)) as container:
    print(json.dumps({'duration': container.duration / av.time_base, 'metadata': container.metadata}, ensure_ascii=False), flush=True)
    resampler = av.AudioResampler(format='fltp', layout='mono', rate=16000)
    samples = [out.to_ndarray().ravel() for frame in container.decode(audio=0) for out in resampler.resample(frame)]
    samples.extend(out.to_ndarray().ravel() for out in resampler.resample(None))
audio = np.concatenate(samples)
model = WhisperModel('base', device='cpu', compute_type='int8', download_root=str(Path(os.environ['TEMP']) / 'bean-rush-choir-models'))
segments, info = model.transcribe(audio, language='zh', beam_size=5, word_timestamps=True, condition_on_previous_text=False)
result = []
for segment in segments:
    item = {'start': segment.start, 'end': segment.end, 'text': segment.text,
        'words': [{'start': w.start, 'end': w.end, 'text': w.word, 'probability': w.probability} for w in segment.words]}
    result.append(item)
    print(json.dumps(item, ensure_ascii=False), flush=True)
Path('artifacts/flower-choir/transcript.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
