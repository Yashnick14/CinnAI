from pathlib import Path
import numpy as np
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from app.ai_assistant.measurement_intent import extract_diameter_mm
from app.ai_assistant.cinnamon_assistant_final import classify_diameter
from app.ai_assistant.retrieval import Retriever
from app.ai_assistant.service import AssistantService, AssistantGenerationError, AssistantUnavailable
from app.api.routes import assistant
from app.main import app

QUESTIONS = [
    ('How can I produce Alba quality cinnamon quills?', None, None),
    ('My cinnamon quill diameter is 19.4 mm. What grade is it and why?', 19.4, 'M4'),
    ('My cinnamon quill diameter is exactly 21 mm. What grade is it?', 21.0, 'Manual Review'),
    ('The handbook says Alba must be below 7 mm, correct?', None, None),
    ('What exact humidity percentage should the storage room be kept at?', None, None),
    ('Can moisture change the final grade?', None, None),
]

class Encoder:
    def encode(self, queries, normalize_embeddings):
        assert normalize_embeddings is True
        return np.ones((1, 384)) / np.sqrt(384)

@pytest.fixture
def service():
    prompts = []
    def generate(**kwargs):
        assert kwargs['model'] == 'gemini-3.5-flash-lite'
        prompts.append(kwargs['contents'])
        return SimpleNamespace(text='Please follow the application diameter policy.')
    result = AssistantService(Retriever(Encoder()), SimpleNamespace(models=SimpleNamespace(generate_content=generate)))
    result.prompts = prompts
    return result

@pytest.mark.parametrize('question,diameter,grade', QUESTIONS)
def test_six_question_contract_and_grounding(monkeypatch, service, question, diameter, grade):
    monkeypatch.setattr(assistant, 'get_assistant_service', lambda: service)
    # No lifespan: these tests must not load or touch the vision models.
    api = TestClient(app)
    response = api.post('/assistant/ask', json={'question': question})
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {'answer', 'detected_diameter_mm', 'application_grade'}
    assert body['detected_diameter_mm'] == diameter
    assert body['application_grade'] == grade
    prompt = service.prompts[-1]
    assert 'never changes the diameter-based grade' in prompt
    assert 'Never invent missing standards' in prompt
    assert 'Never claim that a production method guarantees' in prompt
    assert '14% by mass' in prompt
    if 'Alba' in question:
        assert 'Grade table row for Alba' in prompt
        assert '6 mm' in prompt
    if grade:
        assert f'Application classification:\n{grade}' in prompt
        assert 'RECORD ID: P01' in prompt
    else:
        assert 'APPLICATION CALCULATION:' not in prompt

@pytest.mark.parametrize('question,expected', [
    ('my quill is 19.4 mm',19.4), ('measured diameter is 19.4 mm',19.4),
    ('this quill has a diameter of 19.4 mm',19.4), ('what grade is 19.4 mm?',19.4),
    ('Why is 19.4 mm classified as M4?',19.4),
    ('what is the M4 reference diameter?',None),
    ('what range does the application use for H1?',None),
    ('The handbook says what grade is 7 mm?',None),
    ('my quill is -7 mm',None), ('my quill is 0 mm',None),
    ('my quill is 19 mm; my sample is 22 mm',None),
    ('handbook reference 21 mm; my quill is 19.4 mm',19.4),
])
def test_measurement_intent(question, expected):
    assert extract_diameter_mm(question) == expected

@pytest.mark.parametrize('value', [6.9,7,9.9,10,10.1,11.9,12,12.1,15.9,16,16.1,17.9,18,18.1,20.9,21,21.1,24,24.9,25,25.1,32,32.1])
def test_reuses_existing_grading(value):
    from app.ml.measurement.config import diameter_grade
    assert classify_diameter(value) == diameter_grade(value).replace('Manual review','Manual Review')

def test_exact_colab_ranking_parity(service):
    # Execute original supplied implementation, removing only eager model construction.
    # Independent expected algorithm verifies all weights and ordering below.
    from sklearn.metrics.pairwise import cosine_similarity
    from app.ai_assistant.cinnamon_assistant_final import detect_grade
    r = service.retriever
    for q in ['produce alba', 'requirements for alba', 'dry quills', 'moisture', 'improve preparation', 'M4 grade']:
        base = cosine_similarity(Encoder().encode([q], True), r.embeddings)[0]
        expected=[]
        for idx,d in enumerate(r.documents):
            rec=d['full_record']; g=detect_grade(q); score=float(base[idx])
            if g and g in rec.get('relevant_grade',[]): score+=.20
            if g and f'grade table row for {g.lower()}' in rec.get('corrected_english','').lower(): score+=.20
            if rec.get('id') in r.get_answering_guide_ids(q): score+=.18
            for keyword in rec.get('rag_keywords',[]):
                if str(keyword).lower() in q.lower(): score+=.03
            if any(w in q for w in ['produce','make','prepare','processing']) and rec.get('topic') in ['preparation','quill_structure','drying','filling','handling','moisture']: score+=.04
            expected.append((score,d['id']))
        expected.sort(key=lambda x:x[0],reverse=True)
        actual=r.retrieve(q,12)
        assert [(x['score'],x['id']) for x in actual] == expected[:12]

def test_provider_failure_and_private_output(service):
    for output in ['', 'Gemini retrieved record G01', 'cosine similarity scores']:
        service.client.models.generate_content=lambda **kw: SimpleNamespace(text=output)
        with pytest.raises(AssistantGenerationError): service.ask('What is Alba?')
    def fail(**kw): raise RuntimeError('secret provider detail')
    service.client.models.generate_content=fail
    with pytest.raises(AssistantGenerationError, match='Please try again'): service.ask('What is Alba?')

def test_missing_key(monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY',raising=False)
    with pytest.raises(AssistantUnavailable,match='GEMINI_API_KEY'): AssistantService.load()

def test_lazy_once(monkeypatch, service):
    import app.ai_assistant.service as module
    monkeypatch.setattr(module,'_service',None)
    calls=[]
    monkeypatch.setattr(module.AssistantService,'load',lambda: calls.append(1) or service)
    assert module.get_assistant_service() is module.get_assistant_service()
    assert len(calls)==1

def test_route_errors(monkeypatch):
    api=TestClient(app)
    for question in ['', '   ', 42, 'a'*4001]:
        assert api.post('/assistant/ask',json={'question':question}).status_code == 422
    for error,status in [(AssistantUnavailable('Not configured'),503),(AssistantGenerationError('Try again'),502)]:
        def fail(): raise error
        monkeypatch.setattr(assistant,'get_assistant_service',fail)
        assert api.post('/assistant/ask',json={'question':'Alba?'}).status_code == status
    assert api.get('/health').json()=={'status':'ok'}
