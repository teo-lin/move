"""Builds src/data/quotes.ts from the curated list below (English + Romanian).

Run: python scripts/make-quotes.py
"""
import json
from pathlib import Path

Q = [
    ("The journey of a thousand miles begins with a single step.", "Lao Tzu", "O călătorie de o mie de mile începe cu un singur pas."),
    ("It does not matter how slowly you go as long as you do not stop.", "Confucius", "Nu contează cât de încet mergi, atâta timp cât nu te oprești."),
    ("We are what we repeatedly do. Excellence, then, is not an act, but a habit.", "Will Durant", "Suntem ceea ce facem în mod repetat. Excelența nu este un act, ci un obicei."),
    ("The only bad workout is the one that didn't happen.", "Proverb", "Singurul antrenament prost este cel care nu a avut loc."),
    ("A little progress each day adds up to big results.", "Proverb", "Un mic progres în fiecare zi se adună în rezultate mari."),
    ("Well done is better than well said.", "Benjamin Franklin", "Fapta bine făcută valorează mai mult decât vorba bine spusă."),
    ("The secret of getting ahead is getting started.", "Mark Twain", "Secretul progresului este să începi."),
    ("Fall seven times, stand up eight.", "Japanese proverb", "Cazi de șapte ori, ridică-te de opt."),
    ("Energy and persistence conquer all things.", "Benjamin Franklin", "Energia și perseverența biruiesc totul."),
    ("You are stronger than you think.", "Proverb", "Ești mai puternic decât crezi."),
    ("Take care of your body. It's the only place you have to live.", "Jim Rohn", "Ai grijă de corpul tău. Este singurul loc în care trăiești."),
    ("Motivation gets you going, but discipline keeps you growing.", "John C. Maxwell", "Motivația te pune în mișcare, disciplina te face să crești."),
    ("The body achieves what the mind believes.", "Napoleon Hill", "Corpul realizează ceea ce mintea crede."),
    ("Do something today that your future self will thank you for.", "Sean Patrick Flanery", "Fă azi ceva pentru care viitorul tău eu îți va mulțumi."),
    ("Success is the sum of small efforts, repeated day in and day out.", "Robert Collier", "Succesul este suma unor mici eforturi repetate zi de zi."),
    ("What you do every day matters more than what you do once in a while.", "Gretchen Rubin", "Ce faci în fiecare zi contează mai mult decât ce faci din când în când."),
    ("Rest if you must, but don't you quit.", "John Greenleaf Whittier", "Odihnește-te dacă trebuie, dar nu renunța."),
    ("Courage doesn't always roar. Sometimes it's the quiet voice saying, I will try again tomorrow.", "Mary Anne Radmacher", "Curajul nu răcnește mereu. Uneori e vocea liniștită care spune: voi încerca din nou mâine."),
    ("Strength does not come from the body. It comes from the will.", "Mahatma Gandhi", "Puterea nu vine din corp, ci din voință."),
    ("The best way to predict the future is to create it.", "Peter Drucker", "Cel mai bun mod de a prevedea viitorul este să-l creezi."),
    ("Believe you can and you're halfway there.", "Theodore Roosevelt", "Crede că poți și ești deja la jumătatea drumului."),
    ("Act as if what you do makes a difference. It does.", "William James", "Poartă-te de parcă ceea ce faci contează. Contează."),
    ("The harder I work, the luckier I get.", "Samuel Goldwyn", "Cu cât muncesc mai mult, cu atât am mai mult noroc."),
    ("Patience and perseverance have a magical effect before which difficulties disappear.", "John Quincy Adams", "Răbdarea și perseverența au un efect magic în fața căruia greutățile dispar."),
    ("Every accomplishment starts with the decision to try.", "Gail Devers", "Orice reușită începe cu hotărârea de a încerca."),
    ("You don't have to be great to start, but you have to start to be great.", "Zig Ziglar", "Nu trebuie să fii grozav ca să începi, dar trebuie să începi ca să devii grozav."),
    ("Health is a state of complete harmony of the body, mind and spirit.", "B.K.S. Iyengar", "Sănătatea este o stare de armonie deplină între corp, minte și spirit."),
    ("Walking is man's best medicine.", "Hippocrates", "Mersul pe jos este cel mai bun medicament al omului."),
    ("To keep the body in good health is a duty; otherwise we shall not be able to keep our mind strong and clear.", "Buddha", "A-ți păstra corpul sănătos este o datorie; altfel nu ne vom putea păstra mintea puternică și limpede."),
    ("Look after your body and it will look after you.", "Proverb", "Ai grijă de corpul tău și el va avea grijă de tine."),
    ("Nothing will work unless you do.", "Maya Angelou", "Nimic nu va funcționa dacă nu muncești."),
    ("The pain you feel today will be the strength you feel tomorrow.", "Proverb", "Durerea de azi va fi puterea de mâine."),
    ("Small steps every day.", "Proverb", "Pași mici în fiecare zi."),
    ("Don't count the days, make the days count.", "Muhammad Ali", "Nu număra zilele, fă ca zilele să conteze."),
    ("Whether you think you can or you think you can't, you're right.", "Henry Ford", "Fie că crezi că poți, fie că crezi că nu poți, ai dreptate."),
    ("It always seems impossible until it's done.", "Nelson Mandela", "Pare mereu imposibil până când e făcut."),
    ("Quality is not an act, it is a habit.", "Aristotle", "Calitatea nu este un act, ci un obicei."),
    ("The only way to do great work is to love what you do.", "Steve Jobs", "Singura cale de a face lucruri mari este să iubești ceea ce faci."),
    ("Little by little, one travels far.", "J.R.R. Tolkien", "Puțin câte puțin, ajungi departe."),
    ("Slow progress is still progress.", "Proverb", "Un progres lent rămâne progres."),
    ("Be patient with yourself. Nothing in nature blooms all year.", "Proverb", "Fii răbdător cu tine. Nimic în natură nu înflorește tot anul."),
    ("You can't pour from an empty cup. Take care of yourself first.", "Proverb", "Nu poți turna dintr-o cană goală. Ai grijă mai întâi de tine."),
    ("The man who moves a mountain begins by carrying away small stones.", "Confucius", "Omul care mută un munte începe prin a căra pietre mici."),
    ("Great things are done by a series of small things brought together.", "Vincent van Gogh", "Lucrurile mari se fac dintr-o serie de lucruri mici puse laolaltă."),
    ("Perseverance is not a long race; it is many short races one after the other.", "Walter Elliot", "Perseverența nu e o cursă lungă, ci multe curse scurte, una după alta."),
    ("The difference between try and triumph is a little umph.", "Marvin Phillips", "Diferența dintre a încerca și a triumfa este un strop de efort."),
    ("Today is a good day to have a good day.", "Proverb", "Azi e o zi bună ca să ai o zi bună."),
    ("Your body can stand almost anything. It's your mind you have to convince.", "Proverb", "Corpul tău poate îndura aproape orice. Mintea trebuie convinsă."),
    ("Fitness is not about being better than someone else. It's about being better than you used to be.", "Proverb", "Forma fizică nu înseamnă să fii mai bun decât altcineva, ci mai bun decât erai."),
    ("The groundwork for all happiness is good health.", "Leigh Hunt", "Temelia oricărei fericiri este sănătatea."),
    ("Happiness is the highest form of health.", "Dalai Lama", "Fericirea este cea mai înaltă formă de sănătate."),
    ("An early-morning walk is a blessing for the whole day.", "Henry David Thoreau", "O plimbare dimineața devreme este o binecuvântare pentru toată ziua."),
    ("Take a deep breath. You did something good for yourself today.", "Proverb", "Respiră adânc. Ai făcut azi ceva bun pentru tine."),
    ("Self-care is how you take your power back.", "Lalah Delia", "Grija de sine este modul în care îți recapeți puterea."),
    ("Start where you are. Use what you have. Do what you can.", "Arthur Ashe", "Începe de unde ești. Folosește ce ai. Fă ce poți."),
    ("What lies behind us and what lies before us are tiny matters compared to what lies within us.", "Ralph Waldo Emerson", "Ce e în urma noastră și ce e în fața noastră sunt lucruri mărunte față de ce se află înăuntrul nostru."),
    ("You are never too old to set another goal or to dream a new dream.", "C.S. Lewis", "Nu ești niciodată prea bătrân ca să-ți propui un nou țel sau să visezi un nou vis."),
    ("Discipline is choosing between what you want now and what you want most.", "Abraham Lincoln", "Disciplina înseamnă să alegi între ce vrei acum și ce vrei cel mai mult."),
    ("I am not afraid of storms, for I am learning how to sail my ship.", "Louisa May Alcott", "Nu mă tem de furtuni, căci învăț să-mi conduc corabia."),
    ("Do what you can, with what you have, where you are.", "Theodore Roosevelt", "Fă ce poți, cu ce ai, de unde ești."),
    ("The best project you'll ever work on is you.", "Proverb", "Cel mai bun proiect la care vei lucra vreodată ești tu."),
    ("Even a small step forward is a step forward.", "Proverb", "Chiar și un pas mic înainte rămâne un pas înainte."),
    ("You've got this.", "Proverb", "Poți face asta."),
    ("Be proud of how far you've come, and have faith in how far you can go.", "Proverb", "Fii mândru de cât de departe ai ajuns și crede în cât de departe poți merge."),
    ("Consistency is what transforms average into excellence.", "Proverb", "Constanța este ceea ce transformă mediocrul în excelență."),
    ("A year from now you will wish you had started today.", "Karen Lamb", "Peste un an îți vei dori să fi început azi."),
    ("Nothing is impossible; the word itself says I'm possible.", "Audrey Hepburn", "Nimic nu e imposibil; chiar cuvântul spune: eu sunt posibil."),
    ("Tough times never last, but tough people do.", "Robert H. Schuller", "Vremurile grele nu durează, dar oamenii puternici da."),
    ("What we think, we become.", "Buddha", "Ceea ce gândim, devenim."),
    ("In the middle of every difficulty lies opportunity.", "Albert Einstein", "În mijlocul fiecărei greutăți se află o oportunitate."),
    ("Strive for progress, not perfection.", "Proverb", "Urmărește progresul, nu perfecțiunea."),
    ("The only person you should try to be better than is the person you were yesterday.", "Proverb", "Singura persoană mai bună decât care ar trebui să fii este cea de ieri."),
    ("Every day is a new beginning. Take a deep breath and start again.", "Proverb", "Fiecare zi e un nou început. Respiră adânc și o iei de la capăt."),
    ("Joy is the simplest form of gratitude.", "Karl Barth", "Bucuria este cea mai simplă formă de recunoștință."),
    ("Rome wasn't built in a day, but they were laying bricks every hour.", "John Heywood", "Roma nu s-a construit într-o zi, dar se puneau cărămizi în fiecare oră."),
    ("Be the change you wish to see in the world.", "Mahatma Gandhi", "Fii schimbarea pe care vrei s-o vezi în lume."),
    ("Well begun is half done.", "Aristotle", "Un început bun înseamnă jumătate din treabă."),
    ("Happiness is not something ready-made. It comes from your own actions.", "Dalai Lama", "Fericirea nu e ceva gata făcut. Vine din propriile tale fapte."),
    ("The mind is everything. What you think you become.", "Buddha", "Mintea este totul. Ceea ce gândești devii."),
    ("You miss one hundred percent of the shots you don't take.", "Wayne Gretzky", "Ratezi o sută la sută din loviturile pe care nu le încerci."),
    ("Keep going. Every step is progress.", "Proverb", "Continuă. Fiecare pas e un progres."),
    ("Great job today. Your body says thank you.", "Proverb", "Treabă bună azi. Corpul tău îți mulțumește."),
    ("Feel the strength you've built today.", "Proverb", "Simte puterea pe care ai construit-o azi."),
    ("A healthy outside starts from the inside.", "Robert Urich", "Un exterior sănătos începe din interior."),
    ("Take it one day at a time.", "Proverb", "Ia-o zi cu zi."),
    ("Love yourself enough to take care of yourself.", "Proverb", "Iubește-te destul cât să ai grijă de tine."),
    ("Gratitude turns what we have into enough.", "Proverb", "Recunoștința face din ce avem destul."),
    ("There is no elevator to success. You have to take the stairs.", "Zig Ziglar", "Nu există lift spre succes. Trebuie să urci pe scări."),
    ("Doubt kills more dreams than failure ever will.", "Suzy Kassem", "Îndoiala ucide mai multe vise decât eșecul."),
    ("What seems hard today will one day be your warm-up.", "Proverb", "Ce pare greu azi va fi într-o zi încălzirea ta."),
    ("Showing up is half the battle.", "Woody Allen", "A te prezenta este jumătate din bătălie."),
    ("The future depends on what you do today.", "Mahatma Gandhi", "Viitorul depinde de ceea ce faci azi."),
    ("Be gentle with yourself. You are doing the best you can.", "Proverb", "Fii blând cu tine. Faci tot ce poți."),
    ("Calm mind brings inner strength and self-confidence.", "Dalai Lama", "O minte calmă aduce putere interioară și încredere în sine."),
    ("Move a little, feel a lot better.", "Proverb", "Mișcă-te puțin, simte-te mult mai bine."),
    ("You showed up. That's the hardest part.", "Proverb", "Te-ai prezentat. Asta e partea cea mai grea."),
    ("Do not wait to strike till the iron is hot; make it hot by striking.", "William Butler Yeats", "Nu aștepta să bați fierul cât e cald; încălzește-l bătându-l."),
    ("Success usually comes to those who are too busy to be looking for it.", "Henry David Thoreau", "Succesul vine de obicei la cei prea ocupați ca să-l caute."),
    ("Healthy habits are learned in the same way as unhealthy ones: through practice.", "Wayne Dyer", "Obiceiurile sănătoase se învață la fel ca cele nesănătoase: prin exercițiu."),
    ("The wise man should consider that health is the greatest of human blessings.", "Hippocrates", "Omul înțelept ar trebui să considere sănătatea cea mai mare binecuvântare omenească."),
]
assert len(Q) >= 100, len(Q)

rows = [
    "  {text: %s, author: %s, ro: %s}," % (json.dumps(en, ensure_ascii=False), json.dumps(au, ensure_ascii=False), json.dumps(ro, ensure_ascii=False))
    for en, au, ro in Q
]
out = """/** Short motivational lines for the end-of-workout screen, with Romanian translations. */
export type Quote = {text: string; author: string; ro: string};

export const quotes: Quote[] = [
%s
];

export function pickQuote(random: () => number = Math.random): Quote {
  return quotes[Math.floor(random() * quotes.length)];
}
""" % "\n".join(rows)
Path(__file__).resolve().parent.parent.joinpath("src/data/quotes.ts").write_text(out, encoding="utf-8")
print(len(Q), "quotes")
