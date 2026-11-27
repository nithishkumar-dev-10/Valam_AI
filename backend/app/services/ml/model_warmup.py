"""
app/services/ml/model_warmup.py

Startup pre-warming for the inference models. Loading them once in FastAPI's
lifespan keeps first-request latency (and the Render cold-start spike) out of
the user's voice query. The service singletons ARE the module-level cache;
MODEL_CACHE just gives readiness checks one authoritative place to look.
"""

import time

from starlette.concurrency import run_in_threadpool

from app.utils.logger import logger

# Module-level cache of warmed singletons. Empty until prewarm_models() runs.
MODEL_CACHE: dict[str, object] = {}


def _approx_rss_mb() -> float:
    """Best-effort resident-set size in MB (Linux /proc, macOS rusage fallback)."""
    try:
        with open("/proc/self/statm") as f:
            pages = int(f.read().split()[1])
        return pages * 4096 / (1024 * 1024)
    except (OSError, IndexError, ValueError):
        import resource
        value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # Linux reports KB, macOS reports bytes.
        return value / 1024 if value > 1024 * 1024 else value / (1024 * 1024)


def models_ready() -> bool:
    """True only when every model the voice pipeline may use is loaded."""
    from app.services.dl.disease_service import disease_service
    from app.services.dl.deep_weed_service import deep_weed_service
    from app.routers.pest import pest_service
    from app.services.ml.crop_predictor import crop_predictor

    return (
        disease_service.model is not None
        and deep_weed_service.model is not None
        and pest_service._session is not None
        and crop_predictor is not None
    )


async def prewarm_models() -> None:
    """Load each model once, in a worker thread, logging per-model wall time.

    Models are loaded sequentially on purpose: concurrent torch/ONNX loads
    would spike peak RSS, which is the scarce resource on a 512 MB Render plan.
    """
    # Single-threaded CPU inference: smaller allocator arenas and no threadpool
    # explosion. Must be set before the first inference.
    try:
        import torch
        torch.set_num_threads(1)
        try:
            torch.set_num_interop_threads(1)
        except RuntimeError:
            # Already initialised; harmless in a warm process.
            pass
    except ImportError:
        logger.warning("torch not installed — disease/weed models will be unavailable")

    from app.services.dl.disease_service import disease_service
    from app.services.dl.deep_weed_service import deep_weed_service
    from app.routers.pest import pest_service
    from app.services.ml.crop_predictor import crop_predictor

    steps = (
        ("crop", lambda: None),  # crop_predictor loads at import; just cache it
        ("disease", disease_service._ensure_loaded),
        ("deep_weed", deep_weed_service._ensure_loaded),
        ("pest", pest_service._ensure_loaded),
    )

    for name, loader in steps:
        started = time.perf_counter()
        try:
            await run_in_threadpool(loader)
            MODEL_CACHE[name] = {
                "crop": crop_predictor,
                "disease": disease_service,
                "deep_weed": deep_weed_service,
                "pest": pest_service,
            }[name]
            logger.info("[model-warmup] %s loaded in %dms", name, int((time.perf_counter() - started) * 1000))
        except Exception:
            logger.exception("[model-warmup] %s failed to load", name)

    logger.info(
        "[model-warmup] complete ready=%s approx_rss_mb=%.1f",
        models_ready(), _approx_rss_mb(),
    )
