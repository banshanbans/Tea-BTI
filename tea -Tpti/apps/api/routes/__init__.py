"""路由汇总。

main.py 启动时通过 `from routes import routers` 统一挂载。
"""

from routes import (
    brew,
    drink_feedback,
    feed,
    passport,
    recommendation,
    swipe,
    taste,
    teabti,
)

routers = [
    feed.router,
    swipe.router,
    recommendation.router,
    drink_feedback.router,
    taste.router,
    brew.router,
    passport.router,
    teabti.router,
]
