/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.mskcc.cbio.oncokb.controller;

import org.mskcc.cbio.oncokb.bo.ArticleBo;
import org.mskcc.cbio.oncokb.model.*;
import org.mskcc.cbio.oncokb.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;



@Controller
public class ArticleController {
    @RequestMapping(value = "/legacy-api/article/add/", method = RequestMethod.POST)
    public
    @ResponseBody
    synchronized ResponseEntity newArticleMap(
   
    ) { 
        ArticleBo articleBo = ApplicationContextSingleton.getArticleBo();

        Article newArticle = new Article();
        newArticle.setPmid("666");
        articleBo.save(newArticle);
        return new ResponseEntity(HttpStatus.OK);
    }
}

//PathVariable: parameter aus URL bekommen -> article/add/123 -> 123
//RequestParam: parameter ebenfalls in url, hat aber namen: api/foos?id=abc -> id: abc
//@ApiParam(value = "pmid", required = false) @PathVariable("pmid") String pmid, 
