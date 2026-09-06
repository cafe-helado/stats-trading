# Chance, visually — the nine modules

Ordered so that each one needs only what came before it. The audience is a
person who can already read an option chain and has never taken a statistics
course, which is an unusual combination and the reason the ordering is not a
textbook's.

The rule inherited from the companion series: **never explain a thing before the
reader has watched it happen.** A module's chapters are ordered by what the
simulation makes obvious, not by what a syllabus would do first.

---

## 01 · Three Ways to Say One Number  ✅ live (odds.html)

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

## 02 · Expectation, and Why It Is Not What Happens  ✅ live (ev.html)
EV and variance from a payoff table; the law of large numbers watched
converging; why a positive-edge bettor spends most of a career underwater;
Kelly derived from compounding rather than asserted. Signature: a bankroll
simulator where the reader sets the edge and the stake and watches ruin arrive
at a stake size that still has positive expectation.

## 03 · Randomness Has a Shape  ✅ live (shape.html)
The central limit theorem built from coin flips, so the normal curve is
something that appears rather than something introduced. Then √n scaling, and
the connection to volatility: why an annual number divides by √252 and not 252.
Signature: a Galton board that fills in live, with the normal drawn over it.

## 04 · The Distributions You Actually Meet  ✅ live (dist.html)
Lognormal, Poisson, Student's t, and mixtures. Which one options assume and
where it fails. Signature: a "guess the distribution" drill — the reader sees a
sample and has to name the shape, with the answer scored.

## 05 · What a Sample Can Tell You  ✅ live (sample.html)
Estimators, standard error, confidence intervals, bootstrap. The practical
question: how many days of returns before a volatility estimate is worth
trading on? Signature: resampling done visibly, so a confidence interval is a
thing the reader watched being built.

## 06 · Updating on Evidence  ✅ live (bayes.html)
Bayes as a picture. Base rates, the medical-test problem, and the trader's
version: a stock gaps four standard deviations — was that a four-sigma move or
a wrong volatility estimate? Signature: a grid of squares that repartitions as
the prior moves.

## 07 · Two Things Moving Together  ✅ live (corr.html)
Covariance, correlation, regression, beta, R². Then Anscombe's quartet, which
breaks the summary statistic on purpose. Signature: the reader drags points and
watches the fitted line and the correlation move, including the one point that
moves it most.

## 08 · The Tails Are the Whole Job  ✅ live (tails.html)
Skewness, kurtosis, extreme values, value at risk and expected shortfall. How
much of a portfolio's variance lives in its worst five days. Signature: the
same standard deviation drawn three ways, with wildly different worst cases.

## 09 · Putting It to Work  ✅ live (bet.html)
The capstone. Everything before it is machinery; this is the machinery pointed
at things people actually do with money. Odds setting from the market-maker's
side, bet sizing done properly, and then four applications side by side:
sports betting, blackjack, poker and options trading — which are the same
problem with different variance and different edges.

Examples across the series are American and are deliberately not all financial:
coins, dice, card decks, medical tests, basketball free throws and weather sit
next to option chains, because a reader who has never taken a statistics course
should not have to learn finance and probability in the same sentence.
