import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const songs = await p.song.findMany({ take: 10 });
  console.log('Songs count:', songs.length);
  console.log(JSON.stringify(songs, null, 2));
}
main().catch(console.error).finally(() => p.$disconnect());
