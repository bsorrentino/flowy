import {html, render} from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html';
import type { FlowyDiagram } from 'flowy-engine'

const grabme_img = new URL('../assets/grabme.svg', import.meta.url)

export const TYPE = 'condition'

export const  createTemplate = () => 
    html`
    <div class="blockelem create-flowy noselect">
        <input type="hidden" name="blockelemtype" class="blockelemtype" value="${TYPE}">
        <div class="grabme">
            <img src="${grabme_img}">
        </div>
        <div class="blockin">
            <div class="blockico">
                <span></span>
                <img src="">
            </div>
            <div class="blocktext">
                <p class="blocktitle">Condition</p>
                <p class="blockdesc">This is a condition element</p>
            </div>
        </div>
    </div>    
    `


export const addElement = ( diagram:FlowyDiagram, target:HTMLElement, parent?:HTMLElement ) => {

    const value = (target.querySelector(".blockelemtype") as HTMLDataElement).value

    if( value!==TYPE) return false // GUARD

    addConditionElement( target )

    return true
}


const addConditionElement = ( target:HTMLElement, ) =>  {
    
    const content = 
        html`
        <div>
            <div class='blockyleft'>
                <img src=''>
                    <p class='blockyname'>CONDITION</p>
            </div>
            <div class='blockyright'>
                <img src=''>
            </div>
            <div class='blockydiv'></div>
            <div class='blockyinfo'>condition element</div>
        </div>
        `

    return render( content, target )
}
