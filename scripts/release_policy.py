"""Shared release-age policy; reject policies that shorten the seven-day window."""
import datetime,json,pathlib,functools
ROOT=pathlib.Path(__file__).resolve().parents[1]
def instant(value):
 date=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
 if len(value)==10:date=date.replace(hour=23,minute=59,second=59,microsecond=999999)
 return date if date.tzinfo else date.replace(tzinfo=datetime.timezone.utc)
@functools.lru_cache(maxsize=1)
def policy():
 p=json.loads((ROOT/'dependency-policy.json').read_text())
 if p['minimumAgeDays']<7 or instant(p['cutoff'])>instant(p['evaluatedAt'])-datetime.timedelta(days=p['minimumAgeDays']):raise ValueError('Policy violates the minimum release age.')
 return p
def eligible(value):return bool(value) and instant(value)<instant(policy()['cutoff'])
