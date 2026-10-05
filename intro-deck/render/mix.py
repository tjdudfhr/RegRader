#!/usr/bin/env python3
"""소개 영상의 소리를 만든다.

  python3 mix.py plan    음성 길이로 페이지 시간을 정해 timing.json 을 쓴다 (render.cjs 가 읽음)
  python3 mix.py audio   음성 + 배경음악(음성이 나올 때 낮춤)을 섞어 audio.m4a, 자막 captions.vtt 를 만든다

입력: voice/s01..s11.(mp3|wav), music.(mp3|wav), narration.json
"""
import glob
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30
# 페이지마다 최소 노출 시간(초): 애니메이션이 다 보일 만큼
MIN_DUR = [8.5, 5.5, 6, 6, 6, 5.5, 6.5, 6.5, 8, 5.5, 6]
LEAD = [1.3, 0.7, 0.8, 0.7, 0.7, 0.7, 0.7, 0.8, 0.7, 0.7, 0.9]  # 페이지 시작 → 말 시작
TAIL = 1.0  # 말 끝 → 다음 페이지
END_HOLD = 3.0  # 마지막 말 뒤 여운


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def dur(path):
    out = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).stdout
    return float(out.strip())


def lufs(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'ebur128', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', err)[-1])


VOICE_LUFS = -16  # 목소리
MUSIC_LUFS = -30  # 배경음악 바닥 (목소리보다 14 LU 아래). 목소리가 나오면 여기서 더 낮춘다


def one(pattern):
    hits = sorted(glob.glob(os.path.join(HERE, pattern)))
    if not hits:
        sys.exit(f'없음: {pattern}')
    return hits[0]


def voices():
    return [one(f'voice/s{i:02d}.*') for i in range(1, 12)]


def plan():
    vs = voices()
    pages, t = [], 0.0
    for i, v in enumerate(vs):
        d = dur(v)
        hold = END_HOLD if i == len(vs) - 1 else TAIL
        page = max(MIN_DUR[i], LEAD[i] + d + hold)
        page = round(page * FPS) / FPS
        pages.append({'start': round(t, 3), 'dur': page, 'voiceAt': round(t + LEAD[i], 3), 'voiceLen': round(d, 3)})
        t += page
    json.dump({'fps': FPS, 'total': round(t, 3), 'pages': pages}, open(os.path.join(HERE, 'timing.json'), 'w'), indent=1)
    print(f'total {t:.1f}s', [p['dur'] for p in pages])


def silences(path, n):
    """문장 사이 쉼(가장 긴 n개)의 가운데 시각."""
    err = subprocess.run(['ffmpeg', '-i', path, '-af', 'silencedetect=noise=-38dB:d=0.18', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    total = dur(path)
    gaps = [(e - s, (s + e) / 2) for s, e in zip(starts, ends) if 0.3 < s and e < total - 0.3]
    gaps.sort(reverse=True)
    return sorted(m for _, m in gaps[:n])


def split_sentences(text):
    parts = re.findall(r'[^.?!]+[.?!]?', text)
    return [p.strip() for p in parts if p.strip()]


def stamp(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f'{int(h):02d}:{int(m):02d}:{s:06.3f}'


def captions(vs, timing, lines):
    cues = []
    for i, v in enumerate(vs):
        sents = split_sentences(lines[i]['caption'])
        page = timing['pages'][i]
        length = page['voiceLen']
        cuts = silences(v, len(sents) - 1) if len(sents) > 1 else []
        if len(cuts) != len(sents) - 1:  # 쉼을 못 찾으면 글자 수 비율로 나눈다
            total = sum(len(s) for s in sents)
            acc, cuts = 0, []
            for s in sents[:-1]:
                acc += len(s)
                cuts.append(length * acc / total)
        bounds = [0.0] + cuts + [length]
        for k, s in enumerate(sents):
            a = page['voiceAt'] + bounds[k]
            b = page['voiceAt'] + bounds[k + 1] + (0.4 if k == len(sents) - 1 else 0)
            cues.append((a, b, s))
    with open(os.path.join(HERE, 'captions.vtt'), 'w') as f:
        f.write('WEBVTT\n\n')
        for n, (a, b, s) in enumerate(cues, 1):
            f.write(f'{n}\n{stamp(a)} --> {stamp(b)}\n{s}\n\n')
    print('captions', len(cues))


def audio():
    vs = voices()
    music = one('music.*')
    timing = json.load(open(os.path.join(HERE, 'timing.json')))
    lines = json.load(open(os.path.join(HERE, 'narration.json')))
    total = timing['total']

    inputs, filters, labels = [], [], []
    for i, v in enumerate(vs):
        inputs += ['-i', v]
        ms = int(timing['pages'][i]['voiceAt'] * 1000)
        gain = VOICE_LUFS - lufs(v)
        filters.append(f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,volume={gain:.2f}dB,adelay={ms}|{ms}[v{i}]')
        labels.append(f'[v{i}]')
    m = len(vs)
    inputs += ['-i', music]
    # 음악이 영상보다 짧으면 반복(이음새가 들림) 대신 템포를 살짝 늦춰 길이를 맞춘다
    stretch = min(1.0, dur(music) / total)
    tempo = f'atempo={stretch:.4f},' if stretch < 0.999 else ''
    filters.append(f'{"".join(labels)}amix=inputs={m}:normalize=0:dropout_transition=0,apad,atrim=0:{total}[voice]')
    filters.append('[voice]asplit=2[vmain][vkey]')
    filters.append(
        f'[{m}:a]aresample=48000,aformat=channel_layouts=stereo,{tempo}apad,atrim=0:{total},asetpts=N/SR/TB,'
        f'volume={MUSIC_LUFS - lufs(music):.2f}dB,afade=t=in:st=0:d=1.5,afade=t=out:st={total - 3.5:.2f}:d=3.5[bed]'
    )
    filters.append('[bed][vkey]sidechaincompress=threshold=0.03:ratio=3:attack=80:release=900:makeup=1[duck]')
    filters.append('[vmain][duck]amix=inputs=2:normalize=0,alimiter=limit=0.89:level=disabled[out]')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filters),
           '-map', '[out]', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', os.path.join(HERE, 'audio.m4a')]
    run(cmd)
    print('audio', round(dur(os.path.join(HERE, 'audio.m4a')), 2), 's')
    captions(vs, timing, lines)


if __name__ == '__main__':
    {'plan': plan, 'audio': audio}[sys.argv[1]]()
