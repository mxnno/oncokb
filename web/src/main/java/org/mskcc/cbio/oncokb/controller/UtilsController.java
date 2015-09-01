package org.mskcc.cbio.oncokb.controller;

import com.google.gdata.client.spreadsheet.SpreadsheetService;
import com.google.gdata.data.spreadsheet.*;
import com.google.gdata.util.ServiceException;
import com.google.gdata.util.common.base.Joiner;
import org.json.JSONArray;
import org.json.JSONObject;
import org.mskcc.cbio.oncokb.config.GoogleAuth;
import org.mskcc.cbio.oncokb.util.PropertiesUtils;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.security.GeneralSecurityException;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Created by Hongxin on 9/1/15.
 */
@Controller
public class UtilsController {
    @RequestMapping(value="/utils")
    public @ResponseBody List<Map<String, String>> utils(
            @RequestParam(value="cmd", required=false) String cmd ) throws MalformedURLException, ServiceException {
        if(cmd != null) {
            if(cmd.equals("hotspot")) {
                return getHotSpot();
            }
        }

        return null;
    }

    private static Properties PROPERTIES;
    private static List<Map<String, String>> getHotSpot(){
        try {
            String hotspotSpreadsheet = PropertiesUtils.getProperties("google.hotspot");
            URL SPREADSHEET_FEED_URL = new URL("https://spreadsheets.google.com/feeds/spreadsheets/private/full/" + hotspotSpreadsheet);
            SpreadsheetService service = GoogleAuth.getSpreadSheetService();
            SpreadsheetEntry spreadSheetEntry = service.getEntry(SPREADSHEET_FEED_URL, SpreadsheetEntry.class);

            WorksheetFeed worksheetFeed = service.getFeed(
                    spreadSheetEntry.getWorksheetFeedUrl(), WorksheetFeed.class);
            List<WorksheetEntry> worksheets = worksheetFeed.getEntries();

            return getPMID(worksheets.get(0), service);
        } catch (MalformedURLException ex) {
            Logger.getLogger(OncokbInfo.class.getName()).log(Level.SEVERE, null, ex);
        } catch (GeneralSecurityException ex) {
            Logger.getLogger(OncokbInfo.class.getName()).log(Level.SEVERE, null, ex);
        } catch (IOException ex) {
            Logger.getLogger(OncokbInfo.class.getName()).log(Level.SEVERE, null, ex);
        } catch (ServiceException ex) {
            Logger.getLogger(OncokbInfo.class.getName()).log(Level.SEVERE, null, ex);
        }

        return null;
    }

    private static List<Map<String, String>> getPMID(WorksheetEntry entry, SpreadsheetService service) throws IOException, ServiceException {
        URL userUrl = entry.getListFeedUrl();
        ListFeed list = service.getFeed(userUrl, ListFeed.class);
        // Create a local representation of the new row.
        List<Map<String, String>> hotspots = new ArrayList<>();
        // Iterate through each row, printing its cell values.
        for (ListEntry row : list.getEntries()) {
            Map<String, String> hotspot = new HashMap<>();
            hotspot.put("hugoSymbol", row.getCustomElements().getValue("hugosymbol"));
            hotspot.put("alteration", getAlteration(row.getCustomElements().getValue("codon"), row.getCustomElements().getValue("variantaminoacid")));
            hotspot.put("level", row.getCustomElements().getValue("validationlevel"));
            hotspot.put("pmid", row.getCustomElements().getValue("pmid"));
            hotspots.add(hotspot);
        }
        return hotspots;
    }

    private static String getAlteration(String codon, String aa) {
        StringBuilder sb = new StringBuilder();
        if(codon != null && !codon.isEmpty()) {
            if(aa != null && !aa.isEmpty()) {
                String[] variants = aa.split("\\|");
                List<String> filters = new ArrayList<>();
                for(String variant : variants) {
                    String[] components = variant.split(":");
                    if(components.length == 2 && Integer.parseInt(components[1]) > 5) {
                         filters.add(components[0]);
                    }
                }
                if(filters.size() > 0){
                    sb.append(codon);
                    sb.append(Joiner.on("/").join(filters));
                }
            }else{
                sb.append(codon);
            }
        }
        return sb.toString();
    }
}
