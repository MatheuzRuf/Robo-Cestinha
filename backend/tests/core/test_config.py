import app.core.config as config


def test_default_max_simulation_iterations_is_positive():
    assert config.settings.max_simulation_iterations >= 1


def test_max_simulation_iterations_reads_environment_override(monkeypatch):
    monkeypatch.setenv("MAX_SIMULATION_ITERATIONS", "500")
    assert config.load_settings().max_simulation_iterations == 500