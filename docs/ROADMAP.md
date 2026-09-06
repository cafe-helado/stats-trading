# Chance, visually — the thirteen modules

Ordered so that each one needs only what came before it. The audience is a
person who can already read an option chain and has never taken a statistics
course, which is an unusual combination and the reason the ordering is not a
textbook's.

The rule inherited from the companion series: **never explain a thing before the
reader has watched it happen.** A module's chapters are ordered by what the
simulation makes obvious, not by what a syllabus would do first.

---

## 01 · Counting Without Listing  ✅ live (count.html)

Every probability is a count over a count, so counting comes first. The
multiplication rule, permutations, and combinations as permutations divided
by r!. The birthday problem, poker hands derived from scratch, and the
binomial coefficient revealed as a count rather than a constant.

Verified numbers: P(10,4) = 5,040 against 10⁴ = 10,000; 52! = 8.066 × 10⁶⁷;
C(52,5) = 2,598,960 and C(49,6) = 13,983,816. Birthday: 23 people give
50.7297% and 22 give 47.5695%, with 253 pairs and a Poisson approximation of
50.0002%; matching one named person needs 253 others, at 50.0477%. Every
poker category derived and summing to exactly 2,598,960 — flush 5,108
against straight 10,200, which is why it outranks it. Pascal rows sum to 2ⁿ.

## 02 · The Rules of Probability  ✅ live (rules.html)

Complement, addition, multiplication and conditioning, plus the two
confusions that survive every course.

Verified numbers: at least one six in four rolls is 51.7747% and a double six
in 24 rolls is 49.1404% — de Méré's two bets, 2.63 points apart on either
side of a half, and 25 rolls would have been needed. Heart or face card is
42.3077% against a naive 48.0769%. Two aces without replacement 0.4525%, one
in 221, against 0.5917% with. Six 90% conditions leave 53.1441%. A deck after
20 blacks is 81.25% to give red; a coin is 50% forever. Two children give 1/3
or 1/2 depending on the wording; Monty Hall 2/3 switching, or 1/2 if the host
chooses at random.

## 03 · Three Ways to Say One Number  ✅ live (odds.html)

Probability, odds and price as one object. Fractional / decimal / American, the
overround, de-vigging, then the same arithmetic on an option chain.

Verified: 3/1 = 25% = decimal 4.00 = +300. The worst American rounding error
over 2%–98% is 0.1196 points and it lands at p = 48.9%, right where a tick is
worth most. Both sides of a two-way at −110 imply 52.380952% each, summing to
104.761905%, an overround of 4.761905%; the breakeven hit rate 110/210 is the
same number. A 55% bettor makes $5.00 per 100 risked, a 52% bettor loses 73
cents, and standing two standard errors clear of zero takes 1,444 bets. Backing
both sides costs 4.5455% of the stake. A three-way at 2.10/3.40/3.80 sums to
103.347%. A 1.20/4.50 book sums to 105.556%; proportional de-vigging gives
78.947%/21.053%, the power method (k = 1.1219) gives 81.501%/18.499%, so the
longshot sits 2.554 points lower — the favorite–longshot bias, and the two
methods agree exactly on an even book. On a chain at S=100, K=110, T=0.25,
σ=25%, r=3%: P = 22.214%, the digital costs 0.22048, a 1-wide call spread prices
it at 0.22054, and quoting it 2c wide is a 2.015% overround. At the financing
rate the same one-year 110 strike is 34.966%; at 8% drift it is 42.613% and at
12% it is 48.953%.

## 04 · Describing a Pile of Numbers  ✅ live (describe.html)

Center, spread and position, and which of them survive one bad observation.

Verified numbers: ten salaries give a mean of 167.90 and a median of 54.00;
removing the outlier moves the mean 114.68 and the median 1.00, and pushing it
to 120,000 takes the mean to 12,047.90 while the median never moves. Breakdown
points 0% and 50%. For a normal, IQR = 1.348980σ and MAD = 0.674490σ, with
the inverses 0.741301 and 1.482602. The empirical rule exactly: 68.2689,
95.4500, 99.7300. The 1.5×IQR fence sits at 2.697959σ and fires on 0.6977% of
clean normal points — about one in 143.

## 05 · Expectation, and Why It Is Not What Happens  ✅ live (ev.html)
EV and variance from a payoff table; the law of large numbers watched
converging; why a positive-edge bettor spends most of a career underwater;
Kelly derived from compounding rather than asserted. Signature: a bankroll
simulator where the reader sets the edge and the stake and watches ruin arrive
at a stake size that still has positive expectation.

## 06 · Randomness Has a Shape  ✅ live (shape.html)
The central limit theorem built from coin flips, so the normal curve is
something that appears rather than something introduced. Then √n scaling, and
the connection to volatility: why an annual number divides by √252 and not 252.
Signature: a Galton board that fills in live, with the normal drawn over it.

## 07 · The Distributions You Actually Meet  ✅ live (dist.html)
Lognormal, Poisson, Student's t, and mixtures. Which one options assume and
where it fails. Signature: a "guess the distribution" drill — the reader sees a
sample and has to name the shape, with the answer scored.

## 08 · What a Sample Can Tell You  ✅ live (sample.html)
Estimators, standard error, confidence intervals, bootstrap. The practical
question: how many days of returns before a volatility estimate is worth
trading on? Signature: resampling done visibly, so a confidence interval is a
thing the reader watched being built.

## 09 · Testing a Claim  ✅ live (test.html)

The null as a straw man, the p-value as a statement about data, the two error
types, power, comparing two groups, chi-square, and multiple comparisons.

Verified numbers: 60 heads in 100 gives an exact two-sided p of 0.0569 and a
normal approximation of 0.0455 — opposite verdicts on identical data. The
realized type I rate at n=100 is 3.52%, not 5%. Power against a 55/45 coin is
13.52% at n=100 and 88.01% at n=1000; it first reaches 80% at n=786, dips back
until 819, and is reliable only from 820, because the realized alpha sawtooths
between 4.2% and 5.0%. Two proportions 58/100 against 47/100 give p = 0.1193.
A die at 6.08 on 5 df gives p = 0.2985; a 2×2 table gives χ² = 4.3077 = z²
exactly. Twenty tests at 5% give a 64.15% chance of a false positive.

## 10 · Updating on Evidence  ✅ live (bayes.html)
Bayes as a picture. Base rates, the medical-test problem, and the trader's
version: a stock gaps four standard deviations — was that a four-sigma move or
a wrong volatility estimate? Signature: a grid of squares that repartitions as
the prior moves.

## 11 · Two Things Moving Together  ✅ live (corr.html)
Covariance, correlation, regression, beta, R². Then Anscombe's quartet, which
breaks the summary statistic on purpose. Signature: the reader drags points and
watches the fitted line and the correlation move, including the one point that
moves it most.

## 12 · The Tails Are the Whole Job  ✅ live (tails.html)
Skewness, kurtosis, extreme values, value at risk and expected shortfall. How
much of a portfolio's variance lives in its worst five days. Signature: the
same standard deviation drawn three ways, with wildly different worst cases.

## 13 · Putting It to Work  ✅ live (bet.html)
The capstone. Everything before it is machinery; this is the machinery pointed
at things people actually do with money. Odds setting from the market-maker's
side, bet sizing done properly, and then four applications side by side:
sports betting, blackjack, poker and options trading — which are the same
problem with different variance and different edges.

Examples across the series are American and are deliberately not all financial:
coins, dice, card decks, medical tests, basketball free throws and weather sit
next to option chains, because a reader who has never taken a statistics course
should not have to learn finance and probability in the same sentence.
