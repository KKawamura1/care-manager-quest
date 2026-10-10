#!/usr/bin/env python3
"""Recollect published exam text into a staging file; never overwrite reviewed packs.

Requires Python 3, lxml, curl and pdftotext. No publisher explanations/assets are
copied. Answer keys and classifications remain separately maintained records.
"""
import argparse
import hashlib
import json
import re
import subprocess
import time
from pathlib import Path

from lxml import html

ROOT = Path(__file__).resolve().parents[1]


def fetch(url, cache):
    path = cache / hashlib.sha256(url.encode()).hexdigest()
    if not path.exists():
        temporary = path.with_suffix('.partial')
        subprocess.run(['curl', '-L', '--fail', '--silent', '--show-error',
                        '--max-time', '30', url, '-o', str(temporary)], check=True)
        temporary.replace(path)
        time.sleep(0.3)
    return path


def pdf_rows(path):
    result = subprocess.run(['pdftotext', '-layout', str(path), '-'],
                            capture_output=True, text=True, check=True).stdout
    result = re.sub(r'(?m)^\s*-\s*\d+\s*-\s*平成.*$', '', result)
    blocks = re.split(r'■問題[ \t]*(\d+)[ \t]*\n', result)
    rows = {}
    for j in range(1, len(blocks), 2):
        number, body = int(blocks[j]), blocks[j+1]
        body = re.sub(r'(?m)^\s*(介護支援分野|保健医療サービスの知識等|福祉サービスの知識等|（問題.*）|\(問題.*\))\s*$', '', body)
        options = list(re.finditer(r'(?m)^[ \t]*([1-5])[ \t]{2,}', body))
        if [m.group(1) for m in options] != list('12345'):
            raise ValueError(f'Cannot identify five choices for question {number}')
        join = lambda s: ''.join(line.strip() for line in s.replace('\f', '').splitlines() if line.strip())
        rows[number] = {'stem': join(body[:options[0].start()]),
                        'choices': [join(body[m.end():options[k+1].start() if k < 4 else len(body)]) for k, m in enumerate(options)]}
    if set(rows) != set(range(1,61)):
        raise ValueError('PDF question numbering changed; manual review required')
    return rows


def web_row(path, number, publisher):
    document = html.parse(str(path))
    if publisher == 'care-news':
        node = document.xpath(f'//div[contains(concat(" ",normalize-space(@class)," ")," toi{number} ")]')[0]
        stem = node.xpath('./p[contains(@class,"question")]')[0].text_content().strip()
        choices = [e.text_content().strip() for e in node.xpath('./div[contains(@class,"choice")]/label/em')]
    else:
        node = document.xpath('//div[contains(@class,"problem_detail")]')[0]
        # A law-amendment annotation is publisher material, not part of the exam.
        stem = node.xpath('./div[@class="ttl"]')[0].text_content().strip().split('※')[0].strip()
        choices = [e.text_content().strip() for e in node.xpath('./ul[@class="list"]/li/div')]
    if len(choices) != 5 or not stem or not all(choices):
        raise ValueError(f'Incomplete question {number}')
    return {'stem': stem, 'choices': choices}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    collected, pdfs = [], {}
    for pack in sorted((ROOT/'src/data/packs/pre2018').glob('*/questions.json')):
        for q in json.loads(pack.read_text()):
            url = q['sourceUrl']
            path = fetch(url, args.cache)
            if q['year'] < 2010:
                if url not in pdfs:
                    pdfs[url] = pdf_rows(path)
                text = pdfs[url][q['number']]
            else:
                text = web_row(path, q['number'], 'care-news' if 'care-news.jp' in url else 'kakomonn')
            collected.append({'id':q['id'],'year':q['year'],'number':q['number'],
                              'sourceUrl':url,**text,
                              'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    if len(collected) != 780 or len({q['id'] for q in collected}) != 780:
        raise ValueError('Collection is incomplete')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(collected, ensure_ascii=False, indent=2)+'\n')
    print(f'Collected {len(collected)} questions into {args.output}; review before adoption.')


if __name__ == '__main__':
    main()
