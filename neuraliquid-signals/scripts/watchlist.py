#!/usr/bin/env python3
"""Inspect an unsigned NeuraLiquid offer or read a previously issued day pass."""
import argparse
import http.client
import json
import os
import re
import stat
import sys
from pathlib import Path
from urllib.parse import urlsplit

HOST = 'futurecast.ml85.xyz'
PATH = '/api/v1/x402/signals/patterns'


def fetch(token=None):
    headers = {'Accept': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    connection = http.client.HTTPSConnection(HOST, timeout=30)
    try:
        connection.request('GET', PATH, headers=headers)
        response = connection.getresponse()
        if response.status not in (200, 202, 402, 503):
            raise ValueError(f'HTTP {response.status}. Check the saved pass and its expiry before trying again.')
        return response.status, json.loads(response.read())
    finally:
        connection.close()


def saved_token(path):
    with path.open() as file:
        if stat.S_IMODE(os.fstat(file.fileno()).st_mode) & 0o077:
            raise ValueError('The pass file must be private. Set its permissions to 0600.')
        saved = json.load(file)
    if not isinstance(saved, dict):
        raise ValueError('Expected a NeuraLiquid pass JSON object.')
    details = saved.get('data')
    if not isinstance(details, dict):
        details = {}
    for section in (saved, details):
        for field in ('origin', 'url', 'status_url'):
            if field not in section:
                continue
            value = section[field]
            if not isinstance(value, str):
                raise ValueError('Invalid pass origin or URL.')
            target = urlsplit(value)
            if field != 'origin' and not target.scheme and not target.netloc and value.startswith('/api/v1/x402/'):
                continue
            if target.scheme != 'https' or target.netloc.lower() not in (HOST, HOST + ':443'):
                raise ValueError('This pass identifies a different service.')
    token = saved.get('access_token') or details.get('access_token')
    if not isinstance(token, str) or not re.fullmatch(r'[0-9a-f]{64}', token):
        raise ValueError('No valid bearer token in the pass file. Resume any pending purchase with its original client.')
    return token


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_subparsers(dest='mode', required=True)
    modes.add_parser('offer', help='Fetch the current unsigned x402 terms')
    reader = modes.add_parser('read', help='Fetch a snapshot using a previously issued bearer token')
    reader.add_argument('--pass-file', type=Path, required=True)
    reader.add_argument('--token', help='Show only this asset symbol')
    reader.add_argument('--direction', choices=('long', 'short'))
    args = parser.parse_args()

    if args.mode == 'offer':
        status, body = fetch()
        if status != 402 or body.get('x402Version') != 2 or not body.get('accepts'):
            raise ValueError(f'No x402 v2 offer available (HTTP {status}).')
        return {'x402Version': 2, 'accepts': body['accepts'], 'description': body.get('resource', {}).get('description')}

    status, body = fetch(saved_token(args.pass_file))
    if status == 202:
        return {'status': 'pending', 'retry': 'Use the same pass again after 15 seconds.'}
    if status == 503 and body.get('payment_confirmed') is True:
        return {'status': 'source_unavailable', 'retry': 'Retry the same pass during its original validity.'}
    if status != 200 or body.get('status') != 'confirmed':
        raise ValueError(f'No confirmed snapshot (HTTP {status}). Check the original purchase before trying again.')
    observations = []
    for row in body['data']['signals']:
        if args.token and row['token'].casefold() != args.token.casefold():
            continue
        if args.direction and row['direction'] != args.direction:
            continue
        observations.append({field: row[field] for field in ('direction', 'time', 'token')})
    return {'status': 'confirmed', 'expires_in': body['expires_in'], 'signals': observations}


if __name__ == '__main__':
    try:
        print(json.dumps(main()))
    except (OSError, ValueError, KeyError, TypeError, http.client.HTTPException) as error:
        sys.exit(str(error))
