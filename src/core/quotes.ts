/**
 * Shared quotes collection — single source of truth for the Quotes screen,
 * the My Day quote card, and the Today share card.
 *
 * `getDailyQuote` walks the collection one quote per day using a continuous
 * epoch-day index, so the daily quote is unique for QUOTES.length (120)
 * consecutive days — well past 90 — with no repeats at year boundaries.
 */

export interface Quote {
  text: string;
  author: string;
  category: string;
}

export const QUOTES: Quote[] = [
  // ── Productivity (25) ──
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain', category: 'productivity' },
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss', category: 'productivity' },
  { text: 'Do the hard jobs first. The easy jobs will take care of themselves.', author: 'Dale Carnegie', category: 'productivity' },
  { text: 'Amateurs sit and wait for inspiration, the rest of us just get up and go to work.', author: 'Stephen King', category: 'productivity' },
  { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney', category: 'productivity' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso', category: 'productivity' },
  { text: 'Either you run the day or the day runs you.', author: 'Jim Rohn', category: 'productivity' },
  { text: 'Wake up with determination. Go to bed with satisfaction.', author: '', category: 'productivity' },
  { text: 'Don\'t count the days, make the days count.', author: 'Muhammad Ali', category: 'productivity' },
  { text: 'You don\'t need more time, you need more focus.', author: '', category: 'productivity' },
  { text: 'Productivity is never an accident. It is always the result of commitment to excellence.', author: 'Paul J. Meyer', category: 'productivity' },
  { text: 'Until we can manage time, we can manage nothing else.', author: 'Peter Drucker', category: 'productivity' },
  { text: 'Efficiency is doing things right; effectiveness is doing the right things.', author: 'Peter Drucker', category: 'productivity' },
  { text: 'The key is not to prioritize your schedule, but to schedule your priorities.', author: 'Stephen Covey', category: 'productivity' },
  { text: 'Plans are nothing; planning is everything.', author: 'Dwight D. Eisenhower', category: 'productivity' },
  { text: 'Time is what we want most, but what we use worst.', author: 'William Penn', category: 'productivity' },
  { text: 'Ordinary people think merely of spending time. Great people think of using it.', author: 'Arthur Schopenhauer', category: 'productivity' },
  { text: 'If you spend too much time thinking about a thing, you\'ll never get it done.', author: 'Bruce Lee', category: 'productivity' },
  { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe', category: 'productivity' },
  { text: 'Your work is going to fill a large part of your life. Make it great.', author: 'Steve Jobs', category: 'productivity' },
  { text: 'Work hard in silence, let your success be your noise.', author: 'Frank Ocean', category: 'productivity' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs', category: 'productivity' },
  { text: 'Don\'t wish it were easier, wish you were better.', author: 'Jim Rohn', category: 'productivity' },
  { text: 'There are no shortcuts to any place worth going.', author: 'Beverly Sills', category: 'productivity' },
  { text: 'The difference between ordinary and extraordinary is that little extra.', author: 'Jimmy Johnson', category: 'productivity' },

  // ── Motivation (25) ──
  { text: 'You don\'t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar', category: 'motivation' },
  { text: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu', category: 'motivation' },
  { text: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt', category: 'motivation' },
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill', category: 'motivation' },
  { text: 'What you get by achieving your goals is not as important as what you become.', author: 'Zig Ziglar', category: 'motivation' },
  { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt', category: 'motivation' },
  { text: 'You didn\'t come this far to only come this far.', author: '', category: 'motivation' },
  { text: 'The harder you work for something, the greater you\'ll feel when you achieve it.', author: '', category: 'motivation' },
  { text: 'Don\'t stop when you\'re tired. Stop when you\'re done.', author: '', category: 'motivation' },
  { text: 'Dream bigger. Do bigger.', author: '', category: 'motivation' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius', category: 'motivation' },
  { text: 'Everything you\'ve ever wanted is on the other side of fear.', author: 'George Addair', category: 'motivation' },
  { text: 'Hardships often prepare ordinary people for an extraordinary destiny.', author: 'C.S. Lewis', category: 'motivation' },
  { text: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins', category: 'motivation' },
  { text: 'Keep your face always toward the sunshine and shadows will fall behind you.', author: 'Walt Whitman', category: 'motivation' },
  { text: 'In the middle of every difficulty lies opportunity.', author: 'Albert Einstein', category: 'motivation' },
  { text: 'Life is 10% what happens to you and 90% how you react to it.', author: 'Charles R. Swindoll', category: 'motivation' },
  { text: 'Go confidently in the direction of your dreams.', author: 'Henry David Thoreau', category: 'motivation' },
  { text: 'You are braver than you believe, stronger than you seem, and smarter than you think.', author: 'A.A. Milne', category: 'motivation' },
  { text: 'Challenges are what make life interesting. Overcoming them is what makes life meaningful.', author: 'Joshua J. Marine', category: 'motivation' },
  { text: 'The best revenge is massive success.', author: 'Frank Sinatra', category: 'motivation' },
  { text: 'If opportunity doesn\'t knock, build a door.', author: 'Milton Berle', category: 'motivation' },
  { text: 'Nothing is impossible. The word itself says "I\'m possible!"', author: 'Audrey Hepburn', category: 'motivation' },
  { text: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.', author: 'Ralph Waldo Emerson', category: 'motivation' },
  { text: 'Turn your wounds into wisdom.', author: 'Oprah Winfrey', category: 'motivation' },

  // ── Mindfulness (25) ──
  { text: 'Small daily improvements are the key to staggering long-term results.', author: '', category: 'mindfulness' },
  { text: 'Progress, not perfection.', author: '', category: 'mindfulness' },
  { text: 'Every day is a fresh start.', author: '', category: 'mindfulness' },
  { text: 'Done is better than perfect.', author: '', category: 'mindfulness' },
  { text: 'It\'s not about having time, it\'s about making time.', author: '', category: 'mindfulness' },
  { text: 'Be where you are, not where you think you should be.', author: '', category: 'mindfulness' },
  { text: 'Almost everything will work again if you unplug it for a few minutes, including you.', author: 'Anne Lamott', category: 'mindfulness' },
  { text: 'Today is a good day to try.', author: '', category: 'mindfulness' },
  { text: 'Strive for progress, not perfection.', author: '', category: 'mindfulness' },
  { text: 'Breathe. It\'s just a bad day, not a bad life.', author: '', category: 'mindfulness' },
  { text: 'The present moment is the only moment available to us, and it is the door to all moments.', author: 'Thich Nhat Hanh', category: 'mindfulness' },
  { text: 'Happiness is not something ready-made. It comes from your own actions.', author: 'Dalai Lama', category: 'mindfulness' },
  { text: 'You yourself, as much as anybody in the universe, deserve your love and affection.', author: 'Buddha', category: 'mindfulness' },
  { text: 'Peace comes from within. Do not seek it without.', author: 'Buddha', category: 'mindfulness' },
  { text: 'The mind is everything. What you think you become.', author: 'Buddha', category: 'mindfulness' },
  { text: 'Be kind whenever possible. It is always possible.', author: 'Dalai Lama', category: 'mindfulness' },
  { text: 'Quiet the mind, and the soul will speak.', author: 'Ma Jaya Sati Bhagavati', category: 'mindfulness' },
  { text: 'Nature does not hurry, yet everything is accomplished.', author: 'Lao Tzu', category: 'mindfulness' },
  { text: 'Let go of what you can\'t control. Focus on what you can.', author: '', category: 'mindfulness' },
  { text: 'Your calm mind is the ultimate weapon against your challenges.', author: 'Bryant McGill', category: 'mindfulness' },
  { text: 'Inhale confidence, exhale doubt.', author: '', category: 'mindfulness' },
  { text: 'You don\'t have to control your thoughts. You just have to stop letting them control you.', author: 'Dan Millman', category: 'mindfulness' },
  { text: 'The greatest weapon against stress is our ability to choose one thought over another.', author: 'William James', category: 'mindfulness' },
  { text: 'Slow down and everything you are chasing will come around and catch you.', author: 'John De Paola', category: 'mindfulness' },
  { text: 'Rest when you\'re weary. Refresh and renew yourself, your body, your mind, your spirit.', author: 'Ralph Marston', category: 'mindfulness' },

  // ── Wisdom (25) ──
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb', category: 'wisdom' },
  { text: 'Your limitation — it\'s only your imagination.', author: '', category: 'wisdom' },
  { text: 'Dream it. Wish it. Do it.', author: '', category: 'wisdom' },
  { text: 'Great things never come from comfort zones.', author: '', category: 'wisdom' },
  { text: 'Don\'t watch the clock; do what it does. Keep going.', author: 'Sam Levenson', category: 'wisdom' },
  { text: 'You are never too old to set another goal or to dream a new dream.', author: 'C.S. Lewis', category: 'wisdom' },
  { text: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela', category: 'wisdom' },
  { text: 'Knowledge speaks, but wisdom listens.', author: 'Jimi Hendrix', category: 'wisdom' },
  { text: 'The only true wisdom is in knowing you know nothing.', author: 'Socrates', category: 'wisdom' },
  { text: 'In three words I can sum up everything I\'ve learned about life: it goes on.', author: 'Robert Frost', category: 'wisdom' },
  { text: 'Not everything that is faced can be changed, but nothing can be changed until it is faced.', author: 'James Baldwin', category: 'wisdom' },
  { text: 'The mind is not a vessel to be filled but a fire to be kindled.', author: 'Plutarch', category: 'wisdom' },
  { text: 'We don\'t see things as they are, we see them as we are.', author: 'Anais Nin', category: 'wisdom' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin', category: 'wisdom' },
  { text: 'The only person you are destined to become is the person you decide to be.', author: 'Ralph Waldo Emerson', category: 'wisdom' },
  { text: 'Life isn\'t about finding yourself. Life is about creating yourself.', author: 'George Bernard Shaw', category: 'wisdom' },
  { text: 'The unexamined life is not worth living.', author: 'Socrates', category: 'wisdom' },
  { text: 'Knowing yourself is the beginning of all wisdom.', author: 'Aristotle', category: 'wisdom' },
  { text: 'Be the change that you wish to see in the world.', author: 'Mahatma Gandhi', category: 'wisdom' },
  { text: 'Education is the most powerful weapon which you can use to change the world.', author: 'Nelson Mandela', category: 'wisdom' },
  { text: 'A smooth sea never made a skilled sailor.', author: 'Franklin D. Roosevelt', category: 'wisdom' },
  { text: 'The roots of education are bitter, but the fruit is sweet.', author: 'Aristotle', category: 'wisdom' },
  { text: 'Judge a man by his questions rather than by his answers.', author: 'Voltaire', category: 'wisdom' },
  { text: 'The journey of a thousand miles begins with one step.', author: 'Lao Tzu', category: 'wisdom' },
  { text: 'What we know is a drop, what we don\'t know is an ocean.', author: 'Isaac Newton', category: 'wisdom' },

  // ── Discipline (20) ──
  { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn', category: 'discipline' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Aristotle', category: 'discipline' },
  { text: 'The pain of discipline is nothing like the pain of disappointment.', author: 'Justin Langer', category: 'discipline' },
  { text: 'Motivation gets you going, but discipline keeps you growing.', author: 'John C. Maxwell', category: 'discipline' },
  { text: 'Success isn\'t always about greatness. It\'s about consistency.', author: 'Dwayne Johnson', category: 'discipline' },
  { text: 'Push yourself, because no one else is going to do it for you.', author: '', category: 'discipline' },
  { text: 'Champions keep playing until they get it right.', author: 'Billie Jean King', category: 'discipline' },
  { text: 'There\'s no talent here, this is hard work. This is an obsession.', author: 'Conor McGregor', category: 'discipline' },
  { text: 'The successful warrior is the average man, with laser-like focus.', author: 'Bruce Lee', category: 'discipline' },
  { text: 'I fear not the man who has practiced 10,000 kicks once, but the man who has practiced one kick 10,000 times.', author: 'Bruce Lee', category: 'discipline' },
  { text: 'Fall seven times, stand up eight.', author: 'Japanese Proverb', category: 'discipline' },
  { text: 'Perseverance is not a long race; it is many short races one after the other.', author: 'Walter Elliot', category: 'discipline' },
  { text: 'It\'s not whether you get knocked down, it\'s whether you get up.', author: 'Vince Lombardi', category: 'discipline' },
  { text: 'A river cuts through rock not because of its power, but because of its persistence.', author: 'Jim Watkins', category: 'discipline' },
  { text: 'The only way to guarantee failure is to quit.', author: '', category: 'discipline' },
  { text: 'Hard choices, easy life. Easy choices, hard life.', author: 'Jerzy Gregorek', category: 'discipline' },
  { text: 'No pressure, no diamonds.', author: 'Thomas Carlyle', category: 'discipline' },
  { text: 'Suffer the pain of discipline or suffer the pain of regret.', author: '', category: 'discipline' },
  { text: 'The only limit to our realization of tomorrow is our doubts of today.', author: 'Franklin D. Roosevelt', category: 'discipline' },
  { text: 'Strength does not come from winning. Your struggles develop your strengths.', author: 'Arnold Schwarzenegger', category: 'discipline' },
];

/**
 * Quote of the day. Indexes by a continuous local-time day count (not
 * day-of-year), so consecutive days always advance by one quote and the
 * daily quote stays unique for QUOTES.length consecutive days — including
 * across year boundaries.
 */
export function getDailyQuote(date: Date = new Date()): Quote {
  const localDays = Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
  return QUOTES[localDays % QUOTES.length];
}
