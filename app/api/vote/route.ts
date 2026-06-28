import { ANON_COOKIE, HOURLY_VOTE_LIMIT } from '@/lib/anon';
import {
  computeEloUpdate,
  ELO_INITIAL,
} from '@/lib/elo';
import {
  countVotesSince,
  getEloScore,
  insertEloVote,
  upsertEloScore,
} from '@/lib/db';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type VoteBody = {
  winner?: string;
  loser?: string;
};

export async function POST(req: NextRequest) {
  const anonId = cookies().get(ANON_COOKIE)?.value;
  if (!anonId) {
    return NextResponse.json({ error: 'Missing anon_id cookie' }, { status: 401 });
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if (countVotesSince(anonId, since) >= HOURLY_VOTE_LIMIT) {
    return NextResponse.json({ error: 'Rate limit: 50 votes per hour' }, { status: 429 });
  }

  let body: VoteBody;
  try {
    body = (await req.json()) as VoteBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const winner = body.winner?.trim();
  const loser = body.loser?.trim();

  if (!winner || !loser || winner === loser) {
    return NextResponse.json({ error: 'winner and loser URIs required' }, { status: 400 });
  }

  if (!winner.startsWith('at://') || !loser.startsWith('at://')) {
    return NextResponse.json({ error: 'Invalid performance URI' }, { status: 400 });
  }

  const winnerRow = getEloScore(winner);
  const loserRow = getEloScore(loser);
  const winnerBase = winnerRow.score || ELO_INITIAL;
  const loserBase = loserRow.score || ELO_INITIAL;

  const updated = computeEloUpdate(winnerBase, loserBase);

  upsertEloScore(winner, updated.winner, winnerRow.vote_count + 1);
  upsertEloScore(loser, updated.loser, loserRow.vote_count + 1);
  insertEloVote(winner, loser, anonId);

  return NextResponse.json({
    ok: true,
    scores: {
      [winner]: updated.winner,
      [loser]: updated.loser,
    },
  });
}
