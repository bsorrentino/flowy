import {render, html } from 'lit-html';
import type { FlowyDiagram } from 'flowy-engine'

const grabme_img = new URL('../assets/grabme.svg', import.meta.url)

const TYPE = 'condition'

export const  createTemplate = () => 
    html`
    <div class="blockelem create-flowy noselect" blockelemtype="${TYPE}">
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
    </div>`


export const addElement = ( diagram:FlowyDiagram, target:HTMLElement, parent?:HTMLElement ) => {

    if( !parent ) return false // GUARD

    const value = target.getAttribute('blockelemtype')

    if( value!==TYPE ) return false // GUARD
    
    addConditionElement( target )

    diagram.debugAddLinkedBlock( branchElement('branch' ), target )
    diagram.debugAddLinkedBlock( branchElement('branch' ), target )

    return true
}


const branchElement = (  value:string) => {
    
    const el = document.createElement( 'div' )
    el.classList.add( 'blockelem')
    el.classList.add( 'create-flowy')
    el.classList.add( 'noselect')
    el.setAttribute( 'blockelemtype', `${TYPE}.${value}`)

    const content = html`
        <div>
            <div class='blockyleft'>
                <img src=''>
                <p class='blockyname'>CONDITION</p>
            </div>
            <div class='blockyright'>
                <img src=''>
            </div>
            <div class='blockydiv'></div>
            <div class='blockyinfo'>condition branch</div>
        </div>
        `
    render( content, el )    
    return el
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

    target.innerHTML = '' // delete children
    render( content, target )

}
