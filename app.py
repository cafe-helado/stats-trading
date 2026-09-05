"""
Stats & Probability Interactive Dashboard
Run: streamlit run app.py
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import scipy.stats as stats
import streamlit as st

# ── Page config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Stats for Options Trading",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Global style ─────────────────────────────────────────────────────────────
plt.rcParams.update({
    "figure.facecolor": "#0e1117",
    "axes.facecolor":   "#0e1117",
    "axes.edgecolor":   "#444",
    "axes.labelcolor":  "#ccc",
    "xtick.color":      "#ccc",
    "ytick.color":      "#ccc",
    "text.color":       "#eee",
    "grid.color":       "#333",
    "grid.linewidth":   0.5,
    "axes.spines.top":  False,
    "axes.spines.right":False,
})

BLUE   = "#4fa3e0"
CORAL  = "#e07060"
GREEN  = "#5dbd7a"
YELLOW = "#e0c050"

# ── Sidebar nav ───────────────────────────────────────────────────────────────
SECTIONS = [
    "Distributions",
    "Fat Tails",
    "Monte Carlo",
    "Coin Bias",
    "Bayesian Updater",
    "Vol Estimator",
]
st.sidebar.title("Stats for Options")
section = st.sidebar.radio("Section", SECTIONS)
st.sidebar.markdown("---")
st.sidebar.caption("Notebooks 01–02 · Drag sliders to explore")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. DISTRIBUTIONS
# ═══════════════════════════════════════════════════════════════════════════════
if section == "Distributions":
    st.title("Normal Distribution & Volatility")
    st.markdown(
        "**σ = volatility.** A wider bell curve = more uncertainty = more expensive options."
    )

    col_ctrl, col_plot = st.columns([1, 2])

    with col_ctrl:
        mu    = st.slider("Mean (μ)", -3.0, 3.0, 0.0, 0.1)
        sigma = st.slider("Std dev / Vol (σ)", 0.1, 3.0, 1.0, 0.1)
        show_rule = st.checkbox("Show 68-95-99.7 bands", value=True)
        show_delta = st.checkbox("Show 16-delta line (1σ OTM)", value=True)

    x   = np.linspace(mu - 4 * sigma, mu + 4 * sigma, 500)
    pdf = stats.norm.pdf(x, mu, sigma)

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(x, pdf, color=BLUE, linewidth=2.5)

    if show_rule:
        for n, alpha, color in [(1, 0.25, BLUE), (2, 0.15, GREEN), (3, 0.08, CORAL)]:
            lo, hi = mu - n * sigma, mu + n * sigma
            mask = (x >= lo) & (x <= hi)
            ax.fill_between(x[mask], pdf[mask], alpha=alpha, color=color,
                            label=f"{n}σ  ({stats.norm.cdf(hi, mu, sigma) - stats.norm.cdf(lo, mu, sigma):.1%})")

    if show_delta:
        x_1sd = mu + sigma
        y_1sd = stats.norm.pdf(x_1sd, mu, sigma)
        ax.axvline(x_1sd, color=CORAL, linestyle="--", linewidth=1.2,
                   label=f"1σ OTM ≈ 16-delta ({stats.norm.sf(x_1sd, mu, sigma):.1%} prob ITM)")

    ax.set_xlabel("Return / Price Move")
    ax.set_ylabel("Probability Density")
    ax.set_title(f"Normal(μ={mu:.1f}, σ={sigma:.1f})")
    ax.legend(fontsize=9)
    with col_plot:
        st.pyplot(fig, use_container_width=True)

    # Key insight box
    daily_vol = sigma / np.sqrt(252)
    st.info(
        f"**Trading translation:** If this is annual vol, daily vol ≈ {sigma:.0%}/√252 = **{daily_vol:.2%}** per day. "
        f"A 1σ OTM option (strike at +{sigma:.1f}σ) has roughly **{stats.norm.sf(mu+sigma,mu,sigma):.1%}** chance of expiring ITM."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 2. FAT TAILS
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "Fat Tails":
    st.title("Fat Tails — Where Black-Scholes Breaks")
    st.markdown(
        "Real markets have **more extreme moves** than the normal distribution predicts. "
        "This is why vol skew exists and why OTM puts are expensive."
    )

    col_ctrl, col_plot = st.columns([1, 2])
    with col_ctrl:
        df_val    = st.slider("t-distribution degrees of freedom (df)", 2, 50, 4,
                              help="Lower df = fatter tails. df→∞ converges to normal.")
        threshold = st.slider("Extreme move threshold (σ)", 1.5, 5.0, 3.0, 0.1)
        n_samples = st.select_slider("Sample size", [10_000, 100_000, 500_000], 100_000)

    np.random.seed(99)
    normal_draws = np.random.normal(0, 1, n_samples)
    fat_draws    = np.random.standard_t(df_val, n_samples)

    norm_extreme = np.mean(np.abs(normal_draws) > threshold)
    fat_extreme  = np.mean(np.abs(fat_draws)    > threshold)
    multiplier   = fat_extreme / norm_extreme if norm_extreme > 0 else float("inf")

    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    for ax, data, title, color in [
        (axes[0], normal_draws, "Normal Distribution", BLUE),
        (axes[1], fat_draws,    f"Fat Tails (t, df={df_val})", CORAL),
    ]:
        ax.hist(data, bins=300, density=True, alpha=0.7, color=color)
        ax.axvline( threshold, color=YELLOW, linestyle="--", linewidth=1.2)
        ax.axvline(-threshold, color=YELLOW, linestyle="--", linewidth=1.2, label=f"±{threshold:.1f}σ")
        ax.set_xlim(-8, 8)
        ax.set_title(title)
        ax.set_xlabel("Return (σ)")
        ax.set_ylabel("Density")
        ax.legend(fontsize=9)

    with col_plot:
        st.pyplot(fig, use_container_width=True)

    col1, col2, col3 = st.columns(3)
    col1.metric("Normal: extreme moves",   f"{norm_extreme:.3%}")
    col2.metric(f"Fat tail (df={df_val}): extreme moves", f"{fat_extreme:.3%}",
                delta=f"+{fat_extreme - norm_extreme:.3%}")
    col3.metric("Multiplier", f"{multiplier:.1f}×",
                help="How many more extreme events the fat-tail model predicts")

    st.info(
        f"**Trading translation:** If markets have t(df={df_val}) tails, extreme moves happen **{multiplier:.1f}×** "
        "more often than Black-Scholes expects. That's why OTM options carry a premium — "
        "pure normal pricing would underprice tail risk."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 3. MONTE CARLO
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "Monte Carlo":
    st.title("Monte Carlo Stock Path Simulation")
    st.markdown(
        "Simulate thousands of possible price paths. Count outcomes. That's the foundation "
        "of how exotic options get priced."
    )

    col_ctrl, col_plot = st.columns([1, 2])
    with col_ctrl:
        S0         = st.number_input("Starting price ($)", 50, 500, 100, 10)
        annual_vol = st.slider("Annual vol (%)", 5, 100, 20, 1) / 100
        n_days     = st.slider("Trading days", 21, 252, 252, 21)
        n_paths    = st.select_slider("# simulations", [100, 500, 1000, 5000, 10_000], 1000)
        strike     = st.slider("Strike / level to monitor ($)",
                               int(S0 * 0.5), int(S0 * 1.5), int(S0 * 0.9), 5)
        seed       = st.number_input("Random seed", 0, 9999, 42, 1)

    np.random.seed(int(seed))
    daily_vol    = annual_vol / np.sqrt(252)
    returns_mat  = np.random.normal(0, daily_vol, (n_paths, n_days))
    price_paths  = S0 * np.exp(np.cumsum(returns_mat, axis=1))
    final_prices = price_paths[:, -1]

    pct_above_S0    = np.mean(final_prices > S0)
    pct_below_strike = np.mean(final_prices < strike)

    fig, axes = plt.subplots(1, 2, figsize=(12, 4))

    # Left: paths
    show_n = min(n_paths, 200)
    for i in range(show_n):
        axes[0].plot(price_paths[i], alpha=0.07, linewidth=0.6, color=BLUE)
    axes[0].axhline(S0,     color="white",  linestyle="--", linewidth=1, label=f"Start ${S0}")
    axes[0].axhline(strike, color=CORAL,    linestyle="--", linewidth=1, label=f"Strike ${strike}")
    axes[0].set_xlabel("Trading Days")
    axes[0].set_ylabel("Price")
    axes[0].set_title(f"{show_n} sample paths (vol={annual_vol:.0%})")
    axes[0].legend(fontsize=9)

    # Right: final distribution
    axes[1].hist(final_prices, bins=60, color=BLUE, edgecolor="#0e1117", alpha=0.85)
    axes[1].axvline(S0,     color="white",  linestyle="--", linewidth=1.2, label=f"Start ${S0}")
    axes[1].axvline(strike, color=CORAL,    linestyle="--", linewidth=1.2, label=f"Strike ${strike}")
    axes[1].set_xlabel("Final Price")
    axes[1].set_ylabel("Count")
    axes[1].set_title(f"Distribution of final prices ({n_paths:,} sims)")
    axes[1].legend(fontsize=9)

    with col_plot:
        st.pyplot(fig, use_container_width=True)

    col1, col2, col3 = st.columns(3)
    col1.metric("End > start",         f"{pct_above_S0:.1%}")
    col2.metric(f"End < ${strike}",    f"{pct_below_strike:.1%}",
                help="Probability this put expires ITM")
    col3.metric("Median final price",  f"${np.median(final_prices):.2f}")

    st.info(
        f"**Trading translation:** At {annual_vol:.0%} vol over {n_days} days, "
        f"~{pct_below_strike:.1%} of paths end below ${strike}. "
        f"A ${strike}-strike put priced fairly should reflect this probability."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 4. COIN BIAS (Sequential Bayesian Updating)
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "Coin Bias":
    st.title("Coin Bias — Sequential Bayesian Updating")
    st.markdown(
        "You're handed a coin. You don't know if it's **fair (50%)** or **biased (adjustable)**. "
        "Each flip updates your belief. This mirrors how you update a vol estimate tick-by-tick."
    )

    col_ctrl, col_plot = st.columns([1, 2])
    with col_ctrl:
        p_heads_biased = st.slider("Biased coin: P(heads)", 0.5, 0.95, 0.70, 0.01)
        n_flips        = st.slider("Number of flips", 5, 100, 30)
        truth_biased   = st.checkbox("Truth: coin IS biased", value=True)
        seed2          = st.number_input("Seed", 0, 9999, 42, 1)

    p_heads_fair = 0.50
    np.random.seed(int(seed2))
    true_p = p_heads_biased if truth_biased else p_heads_fair
    flips  = np.random.binomial(1, true_p, n_flips)

    p_fair   = 0.5
    p_biased = 0.5
    history  = [p_biased]

    for f in flips:
        lk_fair   = p_heads_fair   if f else (1 - p_heads_fair)
        lk_biased = p_heads_biased if f else (1 - p_heads_biased)
        uf = lk_fair   * p_fair
        ub = lk_biased * p_biased
        total    = uf + ub
        p_fair   = uf / total
        p_biased = ub / total
        history.append(p_biased)

    fig = plt.figure(figsize=(10, 6))
    gs  = gridspec.GridSpec(2, 1, height_ratios=[1, 3], hspace=0.35)
    ax_flips  = fig.add_subplot(gs[0])
    ax_belief = fig.add_subplot(gs[1])

    # Flip strip
    ax_flips.scatter(
        range(1, n_flips + 1), flips,
        c=[CORAL if f else BLUE for f in flips],
        marker="|", s=200, zorder=3,
    )
    ax_flips.set_yticks([0, 1])
    ax_flips.set_yticklabels(["Tails", "Heads"])
    ax_flips.set_xlim(0, n_flips + 1)
    ax_flips.set_title(
        f"Flips  (truth: {'biased' if truth_biased else 'fair'}, "
        f"P(heads)={true_p:.0%})", fontsize=11
    )

    # Belief update
    ax_belief.plot(history, color=CORAL,  linewidth=2.5, label="P(biased)")
    ax_belief.plot([1 - p for p in history], color=BLUE, linewidth=2.5, label="P(fair)")
    ax_belief.axhline(0.5, color="#666", linestyle="--", alpha=0.6)
    ax_belief.set_xlabel("Flip number")
    ax_belief.set_ylabel("Posterior probability")
    ax_belief.set_ylim(0, 1)
    ax_belief.set_title(
        f"After {n_flips} flips: {history[-1]:.1%} confident coin is biased", fontsize=11
    )
    ax_belief.legend(fontsize=10)

    with col_plot:
        st.pyplot(fig, use_container_width=True)

    col1, col2 = st.columns(2)
    col1.metric("P(biased) after all flips", f"{history[-1]:.1%}")
    col2.metric("Heads observed", f"{sum(flips)}/{n_flips} = {sum(flips)/n_flips:.0%}")

    st.info(
        "**Trading translation:** Replace 'biased coin' with 'stock in a real trending regime'. "
        "Each unusual move (flip = heads) shifts your posterior toward "
        "'something real is happening — not noise'."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 5. BAYESIAN UPDATER (Bayes' theorem / medical test style)
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "Bayesian Updater":
    st.title("Bayesian Updater — Prior × Likelihood = Posterior")
    st.markdown(
        "The classic medical-test version of Bayes. Drag the sliders and watch how "
        "**prior prevalence** dominates the result when the disease is rare."
    )

    col_ctrl, col_plot = st.columns([1, 2])
    with col_ctrl:
        prevalence = st.slider("Prior prevalence (% with condition)", 0.1, 80.0, 1.0, 0.1) / 100
        tpr        = st.slider("True positive rate (sensitivity)", 50, 99, 95, 1) / 100
        fpr        = st.slider("False positive rate",              1,  50, 5,  1) / 100

    p_pos      = tpr * prevalence + fpr * (1 - prevalence)
    posterior  = (tpr * prevalence) / p_pos

    # Bar chart — 10 000 people
    n          = 10_000
    tp = int(n * prevalence * tpr)
    fp = int(n * (1 - prevalence) * fpr)
    total_pos  = tp + fp

    fig, axes = plt.subplots(1, 2, figsize=(11, 4))

    # Left: absolute counts
    bars = axes[0].bar(
        ["True Positives\n(have it, test +)", "False Positives\n(no, test +)"],
        [tp, fp],
        color=[GREEN, CORAL],
        edgecolor="#0e1117",
    )
    for bar, cnt in zip(bars, [tp, fp]):
        axes[0].text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max(tp, fp) * 0.02,
                     str(cnt), ha="center", fontsize=13, fontweight="bold")
    axes[0].set_title(f"Out of {n:,} people — {total_pos} test positive")
    axes[0].set_ylabel("Count")

    # Right: prior vs posterior on probability axis
    labels   = ["Prior\n(prevalence)", "Posterior\n(after + test)"]
    values   = [prevalence, posterior]
    colors   = [BLUE, CORAL]
    b = axes[1].bar(labels, values, color=colors, edgecolor="#0e1117")
    for bar, v in zip(b, values):
        axes[1].text(bar.get_x() + bar.get_width() / 2, v + 0.01,
                     f"{v:.1%}", ha="center", fontsize=14, fontweight="bold")
    axes[1].set_ylim(0, 1)
    axes[1].set_ylabel("Probability")
    axes[1].set_title("Prior vs Posterior probability")

    with col_plot:
        st.pyplot(fig, use_container_width=True)

    col1, col2, col3 = st.columns(3)
    col1.metric("Prior (prevalence)",  f"{prevalence:.2%}")
    col2.metric("Posterior (after +)", f"{posterior:.2%}",
                delta=f"{posterior - prevalence:+.2%}")
    col3.metric("Lift factor",          f"{posterior/prevalence:.1f}×")

    st.info(
        f"**Even with a {tpr:.0%} accurate test**, a positive result only means "
        f"**{posterior:.1%}** chance you actually have the condition — because base rates dominate. "
        "In trading: a signal is only as good as your base rate for *that kind of move*."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 6. VOL ESTIMATOR (Continuous Bayesian vol update)
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "Vol Estimator":
    st.title("Bayesian Vol Estimator")
    st.markdown(
        "You have an implied vol. The stock just made a daily move. "
        "How should you **update your vol estimate**?"
    )

    col_ctrl, col_plot = st.columns([1, 2])
    with col_ctrl:
        implied_vol  = st.slider("Implied vol / prior center (%)", 5, 100, 25, 1) / 100
        prior_width  = st.slider("Prior uncertainty (± % vol)",    1,  20,  5,  1) / 100
        daily_return = st.slider("Observed daily return (%)",      -10, 10,  3,  1) / 100

        st.markdown("---")
        st.markdown("**Run multiple updates**")
        extra_moves_raw = st.text_input(
            "Add more daily returns (comma-separated %, e.g. 2,-1,4)",
            placeholder="e.g. 2,-1,4",
        )

    vol_grid      = np.linspace(0.01, 1.50, 1000)
    daily_vol_grid = vol_grid / np.sqrt(252)

    def bayesian_update(prior_mean, prior_std, daily_ret, vol_g, dv_g):
        prior       = stats.norm.pdf(vol_g, loc=prior_mean, scale=prior_std)
        likelihood  = stats.norm.pdf(daily_ret, loc=0, scale=dv_g)
        post_unnorm = prior * likelihood
        norm_factor = np.trapz(post_unnorm, vol_g)
        if norm_factor == 0:
            return prior / np.trapz(prior, vol_g), prior_mean
        post = post_unnorm / norm_factor
        peak = vol_g[np.argmax(post)]
        return post, peak

    prior_norm = stats.norm.pdf(vol_grid, loc=implied_vol, scale=prior_width)
    prior_norm = prior_norm / np.trapz(prior_norm, vol_grid)

    post1, peak1 = bayesian_update(implied_vol, prior_width, daily_return,
                                   vol_grid, daily_vol_grid)

    # Parse extra moves
    extra_moves = []
    if extra_moves_raw.strip():
        try:
            extra_moves = [float(x.strip()) / 100 for x in extra_moves_raw.split(",") if x.strip()]
        except ValueError:
            st.warning("Could not parse extra moves — use comma-separated numbers.")

    # Run sequential updates
    cur_post  = post1
    cur_peak  = peak1
    history_peaks = [implied_vol, peak1]
    history_labels = ["Prior", f"After {daily_return:.0%}"]

    for i, move in enumerate(extra_moves):
        cur_mean = vol_grid[np.argmax(cur_post)]
        cur_std  = max(prior_width * 0.5, 0.01)      # narrow after each update
        cur_post, cur_peak = bayesian_update(cur_mean, cur_std, move,
                                             vol_grid, daily_vol_grid)
        history_peaks.append(cur_peak)
        history_labels.append(f"After {move:.0%}")

    fig, axes = plt.subplots(1, 2, figsize=(12, 4))

    # Left: prior vs first posterior
    axes[0].plot(vol_grid * 100, prior_norm, color=BLUE,  linewidth=2.5, linestyle="--",
                 label=f"Prior ({implied_vol:.0%} IV)")
    axes[0].plot(vol_grid * 100, post1,      color=CORAL, linewidth=2.5,
                 label=f"Posterior ({peak1:.0%})")
    axes[0].axvline(implied_vol * 100, color=BLUE,  linestyle=":", alpha=0.7)
    axes[0].axvline(peak1 * 100,       color=CORAL, linestyle=":", alpha=0.7)
    axes[0].set_xlabel("Annualized Vol (%)")
    axes[0].set_ylabel("Probability density")
    axes[0].set_title(f"Vol update after {daily_return:.0%} move", fontsize=11)
    axes[0].set_xlim(0, min(150, implied_vol * 500 + 20))
    axes[0].legend(fontsize=10)

    # Right: sequential path of vol estimate
    axes[1].plot(history_peaks, marker="o", color=GREEN, linewidth=2.5, markersize=7)
    axes[1].set_xticks(range(len(history_labels)))
    axes[1].set_xticklabels(history_labels, rotation=20, ha="right", fontsize=9)
    axes[1].axhline(implied_vol, color=BLUE, linestyle="--", alpha=0.6,
                    label=f"Original IV ({implied_vol:.0%})")
    axes[1].set_ylabel("Vol estimate (annualized)")
    axes[1].set_title("Sequential vol updates", fontsize=11)
    axes[1].yaxis.set_major_formatter(plt.FuncFormatter(lambda y, _: f"{y:.0%}"))
    axes[1].legend(fontsize=9)

    with col_plot:
        st.pyplot(fig, use_container_width=True)

    col1, col2, col3 = st.columns(3)
    col1.metric("Prior (implied) vol",        f"{implied_vol:.1%}")
    col2.metric("Posterior after first move",  f"{peak1:.1%}",
                delta=f"{peak1 - implied_vol:+.1%}")
    if extra_moves:
        col3.metric("After all moves",         f"{cur_peak:.1%}",
                    delta=f"{cur_peak - implied_vol:+.1%}")

    expected_daily_vol = implied_vol / np.sqrt(252)
    move_in_sigma = abs(daily_return) / expected_daily_vol if expected_daily_vol > 0 else 0
    st.info(
        f"**Move context:** At {implied_vol:.0%} IV, daily vol ≈ {expected_daily_vol:.2%}. "
        f"Today's {daily_return:.0%} move = **{move_in_sigma:.1f}σ** event. "
        f"{'Large — posterior shifts significantly toward higher vol.' if move_in_sigma > 1.5 else 'Within normal range — small posterior shift.'}"
    )
