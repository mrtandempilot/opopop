/**
 * test-memory-mock.ts — Mock test for memory functions.
 * Supabase bağlantısı gerekmez. `npx tsx scripts/test-memory-mock.ts` ile çalıştır.
 */

// --- Mock storage ---
const mockDb: { userId: number; content: string }[] = [];

// --- Mock saveMemory ---
async function saveMemory(userId: number, content: string): Promise<void> {
    mockDb.push({ userId, content });
}

// --- Mock searchMemories ---
async function searchMemories(userId: number, query: string): Promise<string[]> {
    return mockDb
        .filter((m) => m.userId === userId && m.content.toLowerCase().includes(query.toLowerCase()))
        .map((m) => m.content);
}

// --- Tests ---
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
    if (condition) {
        console.log(`  ✅ PASS: ${label}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${label}`);
        failed++;
    }
}

console.log("\n🧪 Agent Claw — Memory Mock Tests\n");

const USER_ID = 12345;

// Test 1: Save a memory
await saveMemory(USER_ID, "Kahvemi sade içerim");
assert(mockDb.length === 1, "saveMemory → db'ye eklendi");

// Test 2: Save another memory
await saveMemory(USER_ID, "İstanbul'da yaşıyorum");
assert(mockDb.length === 2, "saveMemory → ikinci kayıt eklendi");

// Test 3: Search — match
const results1 = await searchMemories(USER_ID, "kahve");
assert(results1.length === 1, "searchMemories → 'kahve' sorgusu 1 sonuç döndü");
assert(results1[0] === "Kahvemi sade içerim", "searchMemories → doğru içerik döndü");

// Test 4: Search — no match
const results2 = await searchMemories(USER_ID, "çay");
assert(results2.length === 0, "searchMemories → 'çay' sorgusu boş döndü");

// Test 5: Search — different user isolation
await saveMemory(99999, "Başka kullanıcı verisi");
const results3 = await searchMemories(USER_ID, "kullanıcı");
assert(results3.length === 0, "searchMemories → farklı userId izolasyonu çalışıyor");

// --- Summary ---
console.log(`\n📊 Sonuç: ${passed} geçti, ${failed} başarısız\n`);
if (failed > 0) process.exit(1);
