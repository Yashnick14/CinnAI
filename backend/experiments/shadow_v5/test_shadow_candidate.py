import unittest
import cv2
import numpy as np
from shadow_candidate import correct_shadow

class ShadowExperimentTests(unittest.TestCase):
    def scene(self, colour):
        image=np.full((140,200,3),210,np.uint8)
        mask=np.zeros((140,200),np.uint8)
        mask[10:130,60:140]=1
        image[10:130,60:140]=colour
        return image,mask
    def test_clean_body_unchanged(self):
        image,mask=self.scene((40,90,150))
        result,_=correct_shadow(image,mask)
        np.testing.assert_array_equal(result,mask)
    def test_dark_body_not_removed(self):
        image,mask=self.scene((15,25,40))
        result,_=correct_shadow(image,mask)
        np.testing.assert_array_equal(result,mask)
    def test_low_chroma_abstains(self):
        image,mask=self.scene((50,50,50))
        result,_=correct_shadow(image,mask)
        np.testing.assert_array_equal(result,mask)
    def test_empty_mask(self):
        image,mask=self.scene((40,90,150));mask[:]=0
        result,_=correct_shadow(image,mask)
        np.testing.assert_array_equal(result,mask)
    def test_mask_never_expands(self):
        image,mask=self.scene((40,90,150))
        image[10:130,140:160]=(100,100,100)
        mask[10:130,140:160]=1
        result,_=correct_shadow(image,mask)
        self.assertTrue(np.all(result<=mask))
        self.assertTrue(np.all(result[20:120,70:130]==1))
if __name__=="__main__":unittest.main()
