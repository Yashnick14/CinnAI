import numpy as np
import pytest
from app.ml.measurement.quill_edges import edge_position, refine_rows


def test_refines_shadow_mask_to_image_edges_without_fixed_subtraction():
    image=np.full((60,400,3),240,np.uint8)
    image[:,80:320]=200  # soft surrounding shadow, weaker than material transition
    image[:,100:300]=(40,110,170)
    rows=[(y,90,310) for y in range(10,50)]
    result=refine_rows(image,rows,np.ones(len(rows),bool))
    accepted=[r for r in result if r['accepted']]
    assert len(accepted)>=30
    assert np.median([r['width_px'] for r in accepted])==pytest.approx(200,abs=1)


@pytest.mark.parametrize('left,right',[(100,300),(120,280)])
def test_clean_edges_are_not_systematically_shrunk(left,right):
    image=np.full((60,400,3),240,np.uint8)
    image[:,left:right]=(40,110,170)
    rows=[(y,left,right) for y in range(10,50)]
    accepted=[r for r in refine_rows(image,rows,np.ones(len(rows),bool)) if r['accepted']]
    assert len(accepted)==len(rows)
    assert np.median([r['width_px'] for r in accepted])==pytest.approx(right-left,abs=1)


def test_refinement_can_expand_an_undersegmented_mask():
    image=np.full((60,400,3),240,np.uint8)
    image[:,100:300]=(40,110,170)
    rows=[(y,110,290) for y in range(10,50)]
    accepted=[r for r in refine_rows(image,rows,np.ones(len(rows),bool)) if r['accepted']]
    assert len(accepted)>30
    assert np.median([r['width_px'] for r in accepted])==pytest.approx(200,abs=1)


def test_uniform_profile_has_no_edge():
    position,reason=edge_position(np.full((100,3),128,np.float32),50,20)
    assert position is None and reason=='no_clear_transition'


def test_multiple_comparable_edges_are_rejected():
    profile=np.full((100,3),200,np.float32)
    profile[40:50]=80
    position,reason=edge_position(profile,45,15)
    assert position is None and reason=='multiple_ambiguous_edges'


def test_neighbour_width_outliers_are_rejected():
    image=np.full((60,400,3),240,np.uint8)
    image[:,100:300]=(40,110,170)
    image[27:32,100:108]=240
    rows=[(y,100,300) for y in range(10,50)]
    result=refine_rows(image,rows,np.ones(len(rows),bool))
    assert any(r['rejection_reason']=='neighbour_width_outlier' for r in result)
