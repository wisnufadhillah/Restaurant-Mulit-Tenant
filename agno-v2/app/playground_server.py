"""Local-only deterministic simulator, without model or production configuration imports."""
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from .playground import SCENARIOS, execute_playground, evaluate, store
from .playground_ui import HTML

app = FastAPI(title='Restaurant mock simulator')


class Message(BaseModel):
    model_config = {'extra': 'forbid'}
    message: str = Field(min_length=1, max_length=2000)


@app.get('/playground', response_class=HTMLResponse)
async def playground():
    return HTML


@app.get('/api/playground/scenarios')
async def scenarios():
    return SCENARIOS


@app.get('/api/playground/runs')
async def runs():
    return {'runs': store.list()}


@app.post('/api/playground/chat')
async def chat(request: Message):
    run = store.create(request.message)
    await execute_playground(request.message, run)
    return run.as_dict()


@app.post('/api/playground/scenarios/run')
async def scenario_run(request: dict):
    scenario = next((item for item in SCENARIOS if item['id'] == request.get('scenario_id')), None)
    if scenario is None:
        raise HTTPException(status_code=404, detail='Scenario not found')
    run = store.create(scenario['message'], scenario['id'])
    await execute_playground(run.message, run)
    run.evaluation = evaluate(run, scenario)
    return run.as_dict()
