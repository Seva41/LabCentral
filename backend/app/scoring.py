from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ScorePolicy:
    base_points: int
    minimum_points: int
    decay_per_solve: int


class ScoringStrategy(Protocol):
    def award(self, policy: ScorePolicy, prior_solves: int) -> int: ...


class FixedScoring:
    def award(self, policy: ScorePolicy, prior_solves: int) -> int:
        return policy.base_points


class DynamicScoring:
    def award(self, policy: ScorePolicy, prior_solves: int) -> int:
        return max(policy.minimum_points, policy.base_points - prior_solves * policy.decay_per_solve)


STRATEGIES: dict[str, ScoringStrategy] = {
    "fixed": FixedScoring(),
    "dynamic": DynamicScoring(),
}


def points_for(mode: str, policy: ScorePolicy, prior_solves: int) -> int:
    strategy = STRATEGIES.get(mode)
    if strategy is None:
        raise ValueError("Modo de puntaje no válido")
    return strategy.award(policy, prior_solves)
